const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const transport = require("../config/mailer");

exports.cadastrar = async (req, res) => {
  const { nome_empresa, nome_usuario, email, senha } = req.body;
  if (!nome_empresa || !nome_usuario || !email || !senha) {
    return res
      .status(400)
      .json({ message: "Todos os campos são obrigatórios." });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const slug = nome_empresa
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");
    const [empresaResult] = await connection.query(
      "INSERT INTO empresas (nome, slug) VALUES (?, ?)",
      [nome_empresa, slug]
    );
    const empresaId = empresaResult.insertId;
    const senhaHash = await bcrypt.hash(senha, 10);
    await connection.query(
      "INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role) VALUES (?, ?, ?, ?, ?)",
      [empresaId, nome_usuario, email, senhaHash, "admin"]
    );
    await connection.commit();
    res
      .status(201)
      .json({
        message: "Empresa e usuário administrador cadastrados com sucesso!",
      });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Este e-mail já está em uso." });
    console.error(error);
    res
      .status(500)
      .json({ message: "Erro no servidor ao realizar o cadastro." });
  } finally {
    if (connection) connection.release();
  }
};

exports.login = async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res
      .status(400)
      .json({ message: "E-mail e senha são obrigatórios." });
  try {
    const [rows] = await pool.query(
      "SELECT u.*, e.ativo AS empresa_ativa FROM usuarios u JOIN empresas e ON u.empresa_id = e.id WHERE u.email = ?",
      [email]
    );
    const usuario = rows[0];
    if (!usuario)
      return res.status(401).json({ message: "Credenciais inválidas." });
    if (!usuario.empresa_ativa)
      return res
        .status(403)
        .json({ message: "A empresa associada a este usuário está inativa." });
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida)
      return res.status(401).json({ message: "Credenciais inválidas." });
    const token = jwt.sign(
      {
        usuarioId: usuario.id,
        empresaId: usuario.empresa_id,
        nome: usuario.nome,
        role: usuario.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    res
      .status(200)
      .json({
        message: "Login bem-sucedido!",
        token: token,
        role: usuario.role,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro no servidor durante o login." });
  }
};

exports.solicitarResetSenha = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ message: "O e-mail é obrigatório." });
  try {
    const [userRows] = await pool.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email]
    );
    if (userRows.length === 0)
      return res
        .status(200)
        .json({
          message:
            "Se um usuário com este e-mail existir, um código de recuperação será enviado.",
        });
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 5 * 60 * 60 * 1000); // Válido por 5 horas
    await pool.query(
      "UPDATE usuarios SET reset_token = ?, reset_token_expires = ? WHERE email = ?",
      [resetCode, expires, email]
    );
    await transport.sendMail({
      from: `Raposo PDV <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Seu Código de Recuperação de Senha",
      html: `<p>Olá!</p><p>Seu código para redefinir a senha é: <strong>${resetCode}</strong></p><p>Este código expira em 5 horas.</p>`,
    });
    res
      .status(200)
      .json({
        message:
          "Se um usuário com este e-mail existir, um código de recuperação será enviado.",
      });
  } catch (error) {
    console.error("Erro ao solicitar reset de senha:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

exports.redefinirSenha = async (req, res) => {
  const { email, code, novaSenha } = req.body;
  if (!email || !code || !novaSenha)
    return res
      .status(400)
      .json({ message: "E-mail, código e nova senha são obrigatórios." });
  try {
    const [userRows] = await pool.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email]
    );
    if (userRows.length === 0)
      return res.status(400).json({ message: "Código inválido ou expirado." });
    const user = userRows[0];
    const now = new Date();
    if (code !== user.reset_token || now > user.reset_token_expires)
      return res.status(400).json({ message: "Código inválido ou expirado." });
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await pool.query(
      "UPDATE usuarios SET senha_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [senhaHash, user.id]
    );
    res.status(200).json({ message: "Senha redefinida com sucesso!" });
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};
