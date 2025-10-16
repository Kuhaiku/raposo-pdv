const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../config/multer');

const isAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    next();
};

router.use(authMiddleware, isAdmin);

// Rotas principais
router.post('/', upload, produtoController.criarProduto);
router.get('/', produtoController.listarProdutos);

// Novas rotas para ações em massa
router.post('/mass-update-status', produtoController.massUpdateStatus);

// Rotas específicas por ID
router.get('/:id', produtoController.getProdutoById);
router.put('/:id', upload, produtoController.updateProduto);
router.patch('/:id/status', produtoController.updateStatus); // Para ativar/inativar
router.delete('/:id', produtoController.softDelete); // Mover para a lixeira
router.delete('/:id/permanente', produtoController.deletePermanente); // Exclusão definitiva
router.patch('/:id/reorder-fotos', produtoController.reorderFotos);


module.exports = router;