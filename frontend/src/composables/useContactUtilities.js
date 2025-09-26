import { ref, watch, computed } from 'vue'; 

export function useContactUtilities() {
    const openWhatsApp = (contact, phone) => {
        if (!phone) {
            return { success: false, message: 'El contacto no tiene un número de teléfono válido para esta acción.', color: 'warning' };
        }
        
        // 1. Limpiar y estandarizar el número (permite '+' al inicio)
        let phoneNumber = phone.replace(/[^0-9+]/g, '');

        if (!phoneNumber) {
            return { success: false, message: 'El número de teléfono es inválido después de la limpieza.', color: 'error' };
        }

        const localCountryCode = '595';
        
        // Eliminar el '+' inicial si existe (WhatsApp prefiere el formato 595...)
        if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1);
        }

        // 2. Normalización Paraguaya (Eliminar '0' troncal)
        // Si el número comienza con '0' (ej: 0981...) lo quitamos.
        if (phoneNumber.startsWith('0')) {
            phoneNumber = phoneNumber.substring(1);
        }

        // 3. Agregar código de país si falta y es un número local (ej: 981123456)
        // Asumimos que números de longitud 8-10 (8/9 dígitos locales + opcional código de área) son locales.
        if (phoneNumber.length >= 8 && phoneNumber.length <= 10 && !phoneNumber.startsWith(localCountryCode)) {
            phoneNumber = localCountryCode + phoneNumber;
        }

        // 4. Validación final de longitud internacional
        if (phoneNumber.length < 10 || phoneNumber.length > 15) {
             return { success: false, message: `El número resultante (${phoneNumber}) no parece tener un formato internacional válido.`, color: 'error' };
        }

        const url = `https://wa.me/${phoneNumber}`;
        window.open(url, '_blank');
        return { success: true };
    };

    const shareContact = (contact, contactPhones) => {
        if (navigator.share) {
            // Aseguramos que contact.completo y contact.telefonos existen para evitar errores
            const fullName = contact?.completo || `${contact?.nombres || ''} ${contact?.apellidos || ''}`.trim();
            const phones = contactPhones || [];
            
            const phoneList = phones.map(p => `${p.tipo}: ${p.numero}`).join('\n');

            return navigator.share({
                title: `Contacto de ${fullName}`,
                text: `Nombre: ${fullName}\nTeléfonos:\n${phoneList || 'No hay teléfonos registrados.'}`,
            })
            .then(() => {
                return { success: true, message: 'Contacto compartido con éxito.' };
            })
            .catch((err) => {
                // No mostrar el error de usuario si simplemente canceló (abort)
                if (err.name === 'AbortError') {
                    return { success: false, message: 'Compartir cancelado por el usuario.' };
                }
                console.error('Error al compartir el contacto:', err);
                return { success: false, message: 'Error al compartir el contacto.', errorObject: err, color: 'error' };
            });
        } else {
            // Este camino no devuelve una Promesa, lo que es un riesgo de inconsistencia.
            // Es mejor que el consumidor de este composable lo maneje con cautela.
            return { success: false, message: 'La API Web Share no es compatible con este navegador.', color: 'warning' };
        }
    };

    return {
        openWhatsApp,
        shareContact,
    };
}