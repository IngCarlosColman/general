const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Directorio donde se guardarán los archivos
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Asegúrate de que el directorio de subidas existe
if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`[INFO] Creando directorio de subidas: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        const userId = req.user.id || 'unknown';
        const uniqueSuffix = Date.now();
        const finalName = `${userId}-${uniqueSuffix}${extension}`;

        // ✅ Log agregado para trazabilidad
        console.log(`[LOG] Guardando archivo como: ${finalName} en ${UPLOADS_DIR}`);

        cb(null, finalName);
    }
});

// Filtro de archivos para aceptar solo imágenes y PDF
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'application/pdf'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no soportado. Solo se permiten JPG, PNG y PDF.'), false);
    }
};

// Configuración base de Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

// Middleware específico para la subida de UN ÚNICO archivo de comprobante
const uploadProof = upload.single('comprobante');

module.exports = {
    uploadProof
};