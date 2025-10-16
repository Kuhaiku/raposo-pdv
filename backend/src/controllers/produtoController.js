const pool = require('../config/database');
const cloudinary = require('../config/cloudinary');

// Função auxiliar para fazer upload de um buffer de imagem para o Cloudinary
const uploadStream = (buffer, options) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(options, (error, result) => {
            if (result) return resolve(result);
            reject(error);
        }).end(buffer);
    });
};

// --- CRIAR UM NOVO PRODUTO ---
exports.criarProduto = async (req, res) => {
    const { empresaId } = req;
    const { nome, descricao, preco, estoque, codigo, categoria } = req.body;
    const files = req.files || [];

    if (!nome || !preco || !estoque) {
        return res.status(400).json({ message: 'Nome, preço e estoque são obrigatórios.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [empresaRows] = await connection.query('SELECT slug FROM empresas WHERE id = ?', [empresaId]);
        if (empresaRows.length === 0 || !empresaRows[0].slug) {
            throw new Error('Empresa não encontrada para criar diretório de imagens.');
        }
        const folderPath = `raposopdv/${empresaRows[0].slug}/produtos`;

        const [produtoResult] = await connection.query(
            'INSERT INTO produtos (empresa_id, nome, descricao, preco, estoque, codigo, categoria, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [empresaId, nome, descricao, preco, estoque, codigo || null, categoria || null, 'ativo']
        );
        const produtoId = produtoResult.insertId;

        if (files.length > 0) {
            const uploadPromises = files.map(file => uploadStream(file.buffer, { folder: folderPath }));
            const uploadResults = await Promise.all(uploadPromises);
            const fotosParaSalvar = uploadResults.map(result => [produtoId, result.secure_url, result.public_id]);
            await connection.query('INSERT INTO produto_fotos (produto_id, url, public_id) VALUES ?', [fotosParaSalvar]);
        }

        await connection.commit();
        res.status(201).json({ message: 'Produto cadastrado com sucesso!', produtoId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar produto:", error);
        res.status(500).json({ message: 'Erro no servidor ao cadastrar produto.' });
    } finally {
        if (connection) connection.release();
    }
};

// --- LISTAR PRODUTOS (POR STATUS) ---
exports.listarProdutos = async (req, res) => {
    const { empresaId } = req;
    const { status = 'ativo' } = req.query;

    if (!['ativo', 'inativo', 'deletado'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido.' });
    }

    try {
        const query = `
            SELECT p.*, (SELECT pf.url FROM produto_fotos pf WHERE pf.produto_id = p.id ORDER BY pf.ordem ASC, pf.id ASC LIMIT 1) as foto_url
            FROM produtos p
            WHERE p.empresa_id = ? AND p.status = ?
            ORDER BY p.nome ASC
        `;
        const [produtos] = await pool.query(query, [empresaId, status]);
        res.status(200).json(produtos);
    } catch (error) {
        console.error("Erro ao listar produtos:", error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// --- OBTER UM PRODUTO ESPECÍFICO POR ID ---
exports.getProdutoById = async (req, res) => {
    const { id } = req.params;
    const { empresaId } = req;
    try {
        const [produtoRows] = await pool.query('SELECT * FROM produtos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
        if (produtoRows.length === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        const [fotosRows] = await pool.query('SELECT id, url, public_id, ordem FROM produto_fotos WHERE produto_id = ? ORDER BY ordem ASC, id ASC', [id]);
        const produto = { ...produtoRows[0], fotos: fotosRows };
        res.status(200).json(produto);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao obter detalhes do produto.' });
    }
};

// --- ATUALIZAR UM PRODUTO ---
exports.updateProduto = async (req, res) => {
    const { id } = req.params;
    const { empresaId } = req;
    const { nome, descricao, preco, estoque, codigo, categoria, fotosParaRemover } = req.body;
    const files = req.files || [];
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (fotosParaRemover) {
            const fotosARemoverArray = JSON.parse(fotosParaRemover);
            if (Array.isArray(fotosARemoverArray) && fotosARemoverArray.length > 0) {
                const publicIds = fotosARemoverArray.map(f => f.public_id).filter(id => id);
                if (publicIds.length > 0) await cloudinary.api.delete_resources(publicIds);
                
                const dbIds = fotosARemoverArray.map(f => f.id).filter(id => id);
                if (dbIds.length > 0) await connection.query('DELETE FROM produto_fotos WHERE id IN (?)', [dbIds]);
            }
        }

        if (files.length > 0) {
            const [empresaRows] = await connection.query('SELECT slug FROM empresas WHERE id = ?', [empresaId]);
            const folderPath = `raposopdv/${empresaRows[0].slug}/produtos`;
            const uploadPromises = files.map(file => uploadStream(file.buffer, { folder: folderPath }));
            const uploadResults = await Promise.all(uploadPromises);
            const fotosParaSalvar = uploadResults.map(result => [id, result.secure_url, result.public_id]);
            await connection.query('INSERT INTO produto_fotos (produto_id, url, public_id) VALUES ?', [fotosParaSalvar]);
        }
        
        await connection.query(
            'UPDATE produtos SET nome = ?, descricao = ?, preco = ?, estoque = ?, codigo = ?, categoria = ? WHERE id = ? AND empresa_id = ?',
            [nome, descricao, preco, estoque, codigo, categoria, id, empresaId]
        );

        await connection.commit();
        res.status(200).json({ message: 'Produto atualizado com sucesso!' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar produto.' });
    } finally {
        if (connection) connection.release();
    }
};

// --- ATUALIZAR STATUS DE UM PRODUTO (ATIVAR/INATIVAR) ---
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['ativo', 'inativo'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido. Apenas "ativo" ou "inativo" são permitidos.' });
    }
    try {
        await pool.query('UPDATE produtos SET status = ?, deletado_em = NULL WHERE id = ? AND empresa_id = ?', [status, id, req.empresaId]);
        res.status(200).json({ message: `Produto atualizado para ${status}.` });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// --- MOVER PRODUTO PARA A LIXEIRA (SOFT DELETE) ---
exports.softDelete = async (req, res) => {
    const { id } = req.params;
    try {
        // Futuramente, descomente esta seção quando a tabela `venda_itens` existir
        /*
        const [vendas] = await pool.query('SELECT id FROM venda_itens WHERE produto_id = ? LIMIT 1', [id]);
        if (vendas.length > 0) {
            return res.status(400).json({ message: 'Não é possível excluir um produto com histórico de vendas. Por favor, inative-o.' });
        }
        */
        
        await pool.query("UPDATE produtos SET status = 'deletado', deletado_em = NOW() WHERE id = ? AND empresa_id = ?", [id, req.empresaId]);
        res.status(200).json({ message: 'Produto movido para a lixeira.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// --- EXCLUIR PERMANENTEMENTE UM PRODUTO (HARD DELETE) ---
exports.deletePermanente = async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [fotos] = await connection.query('SELECT public_id FROM produto_fotos WHERE produto_id = ?', [id]);
        if (fotos.length > 0) {
            const publicIds = fotos.map(f => f.public_id).filter(id => id);
            if(publicIds.length > 0) await cloudinary.api.delete_resources(publicIds);
        }

        const [result] = await connection.query('DELETE FROM produtos WHERE id = ? AND empresa_id = ?', [id, req.empresaId]);
        if (result.affectedRows === 0) throw new Error('Produto não encontrado ou não pertence à sua empresa.');
        
        await connection.commit();
        res.status(200).json({ message: 'Produto excluído permanentemente.' });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Não é possível excluir um produto que já possui vendas.' });
        }
        res.status(500).json({ message: error.message || 'Erro no servidor ao excluir produto.' });
    } finally {
        if (connection) connection.release();
    }
};

// --- AÇÕES EM MASSA ---
exports.massUpdateStatus = async (req, res) => {
    const { ids, status } = req.body;
    if (!['ativo', 'inativo', 'deletado'].includes(status) || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Dados inválidos.' });
    }
    try {
        const query = "UPDATE produtos SET status = ?, deletado_em = ? WHERE id IN (?) AND empresa_id = ?";
        const deletadoEm = status === 'deletado' ? new Date() : null;
        await pool.query(query, [status, deletadoEm, ids, req.empresaId]);
        res.status(200).json({ message: `${ids.length} produto(s) atualizado(s).` });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// --- REORDENAR FOTOS ---
exports.reorderFotos = async (req, res) => {
    const { id } = req.params; // ID do produto
    const { fotosOrdenadas } = req.body; // Array de IDs das fotos na nova ordem

    if (!Array.isArray(fotosOrdenadas)) {
        return res.status(400).json({ message: "Dados de ordenação inválidos." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const updatePromises = fotosOrdenadas.map((fotoId, index) => {
            return connection.query(
                'UPDATE produto_fotos SET ordem = ? WHERE id = ? AND produto_id = ?',
                [index, fotoId, id]
            );
        });

        await Promise.all(updatePromises);
        await connection.commit();
        res.status(200).json({ message: 'Ordem das fotos atualizada com sucesso.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao reordenar fotos:", error);
        res.status(500).json({ message: 'Erro no servidor ao reordenar fotos.' });
    } finally {
        if (connection) connection.release();
    }
};