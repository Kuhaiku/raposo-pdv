const multer = require("multer");

// Configura o armazenamento em memória, pois vamos enviar o buffer para o Cloudinary
const storage = multer.memoryStorage();

// Middleware de upload (aceita até 10 imagens por vez)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Limite de 5MB por arquivo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Formato de arquivo inválido. Apenas imagens são permitidas."
        ),
        false
      );
    }
  },
}).array("imagens", 10); // 'imagens' deve ser o nome do campo no formulário

module.exports = upload;
