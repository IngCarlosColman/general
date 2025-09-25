// src/utils/token.js
import { jwtDecode } from 'jwt-decode'; // Debes instalar 'jwt-decode' (npm install jwt-decode)

export const decodeToken = (token) => {
    if (!token) return null;
    try {
        const payload = jwtDecode(token);
        
        // Verifica si el token ha expirado
        if (payload.exp * 1000 < Date.now()) {
            console.warn('Token expirado al decodificar.');
            return null;
        }

        // Devolvemos solo los datos relevantes para el frontend
        return {
            id: payload.id, 
            rol: payload.rol, // <--- CLAVE PARA EL CONTROL DE ACCESO
            email: payload.email,
            first_name: payload.first_name, 
            last_name: payload.last_name, 
            // ... otros campos que necesites
        };
    } catch (error) {
        console.error('Error al decodificar el token:', error);
        return null;
    }
};