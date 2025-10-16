const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middlewares/authMiddleware');

const isAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    next();
};

router.post('/cadastrar', authMiddleware, isAdmin, usuarioController.cadastrarFuncionario);
router.post('/fechar-periodo', authMiddleware, usuarioController.fecharPeriodo);

module.exports = router;