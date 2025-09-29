const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Directorio donde se guardarán los archivos
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Asegúrate de que el directorio de subidas existe
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Guarda en la carpeta 'uploads'
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Genera un nombre de archivo único: user-ID-timestamp.ext
        const extension = path.extname(file.originalname);
        const userId = req.user.id || 'unknown'; // req.user.id viene del authenticateJWT
        const uniqueSuffix = Date.now();
        cb(null, `${userId}-${uniqueSuffix}${extension}`);
    }
});

// Filtro de archivos para aceptar solo imágenes y PDF
const fileFilter = (req, file, cb) => {
    // Acepta JPEG, PNG y PDF
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        // Rechaza otros tipos de archivo
        cb(new Error('Tipo de archivo no soportado. Solo se permiten JPG, PNG y PDF.'), false);
    }
};

// Exportamos el middleware de subida configurado
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { 
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

// Middleware específico para un único archivo llamado 'comprobante'
const uploadProof = upload.single('comprobante'); 

module.exports = {
    uploadProof
};
