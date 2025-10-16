const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // Módulo para gerar a senha aleatória
const transport = require('../config/mailer'); // Nosso transportador de e-mail

// Função para o ADMIN cadastrar um novo FUNCIONÁRIO (ATUALIZADA)
exports.cadastrarFuncionario = async (req, res) => {
    const { empresaId } = req;
    const { nome, email } = req.body; // Senha não é mais recebida aqui

    if (!nome || !email) {
        return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
    }

    try {
        // 1. Gerar uma senha aleatória e segura
        const senhaProvisoria = crypto.randomBytes(8).toString('hex');
        const senhaHash = await bcrypt.hash(senhaProvisoria, 10);

        // 2. Salvar o novo usuário no banco com a senha hasheada
        await pool.query(
            'INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role) VALUES (?, ?, ?, ?, ?)',
            [empresaId, nome, email, senhaHash, 'funcionario']
        );
        
        // 3. Enviar a senha provisória por e-mail para o novo funcionário
        await transport.sendMail({
            from: `Raposo PDV <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Bem-vindo(a) ao Time! - Suas Credenciais de Acesso',
            html: `
                <p>Olá, ${nome}!</p>
                <p>Você foi cadastrado no sistema de Ponto de Venda (PDV).</p>
                <p>Use as credenciais abaixo para seu primeiro acesso:</p>
                <ul>
                    <li><strong>E-mail:</strong> ${email}</li>
                    <li><strong>Sua Senha Provisória:</strong> <strong>${senhaProvisoria}</strong></li>
                </ul>
                <p>Recomendamos que você altere sua senha após o primeiro login.</p>
                <p>Atenciosamente,<br>Equipe Raposo PDV</p>
            `,
        });

        res.status(201).json({ message: 'Funcionário cadastrado com sucesso! Uma senha provisória foi enviada para o e-mail dele.' });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        }
        console.error("Erro ao cadastrar funcionário:", error);
        res.status(500).json({ message: 'Erro no servidor ao cadastrar funcionário.' });
    }
};

// ... (resto do arquivo com a função fecharPeriodo) ...
exports.fecharPeriodo = async (req, res) => {
    const { usuarioId, empresaId } = req;
    const { senha } = req.body;
    if (!senha) return res.status(400).json({ message: 'A senha é obrigatória para fechar o período.' });
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [userRows] = await connection.query('SELECT senha_hash, data_inicio_periodo_atual FROM usuarios WHERE id = ?', [usuarioId]);
        const usuario = userRows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            await connection.rollback();
            return res.status(401).json({ message: 'Senha incorreta.' });
        }
        const metricsQuery = `SELECT IFNULL(SUM(valor_total), 0) AS totalVendas, COUNT(id) AS numeroVendas FROM vendas WHERE usuario_id = ? AND data_venda >= ?`;
        const [metricsResult] = await connection.query(metricsQuery, [usuarioId, usuario.data_inicio_periodo_atual]);
        const { totalVendas, numeroVendas } = metricsResult[0];
        const comissao = parseFloat(totalVendas) * 0.15;
        await connection.query('INSERT INTO periodos_fechados (empresa_id, usuario_id, data_inicio, data_fim, total_faturado, numero_vendas, comissao_gerada) VALUES (?, ?, ?, NOW(), ?, ?, ?)', [empresaId, usuarioId, usuario.data_inicio_periodo_atual, totalVendas, numeroVendas, comissao]);
        await connection.query('UPDATE usuarios SET data_inicio_periodo_atual = NOW() WHERE id = ?', [usuarioId]);
        await connection.commit();
        res.status(200).json({ message: 'Período fechado com sucesso!' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao fechar período:", error);
        res.status(500).json({ message: 'Erro no servidor ao fechar o período.' });
    } finally {
        if (connection) connection.release();
    }
};