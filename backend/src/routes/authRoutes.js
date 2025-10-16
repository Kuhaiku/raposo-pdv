const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/cadastrar', authController.cadastrar);
router.post('/login', authController.login);
router.post('/solicitar-reset-senha', authController.solicitarResetSenha);
router.post('/redefinir-senha', authController.redefinirSenha);

module.exports = router;