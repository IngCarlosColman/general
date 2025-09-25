// generate_hash.js
const bcrypt = require('bcryptjs'); // O 'bcrypt' si es el que usas
const password = 'prueba';
const saltRounds = 10; // DEBE coincidir con el valor que usas en tu app.

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error('Error al generar el hash:', err);
        return;
    }
    console.log('Contraseña plana:', password);
    console.log('Hash generado:', hash);
});