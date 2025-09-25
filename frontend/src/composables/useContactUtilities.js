// src/composables/useContactUtilities.js (CORREGIDO)

import { ref, watch, computed } from 'vue'; // Mantenemos solo las importaciones necesarias
// ❌ ELIMINAMOS: import { useSnackbar } from './useSnackbar';

/**
 * Composible para manejar acciones de utilidad relacionadas con contactos.
 * @returns {object} - Un objeto con los métodos de utilidad.
 */
export function useContactUtilities() {
  // ❌ ELIMINAMOS: const { showSnackbar } = useSnackbar();

  /**
   * Abre la aplicación de WhatsApp para enviar un mensaje a un contacto.
   * Retorna { success: boolean, message: string } para errores internos.
   */
  const openWhatsApp = (contact, phone) => {
    if (!phone) {
        // ANTES: showSnackbar('El contacto no tiene un número...', 'warning');
        return { success: false, message: 'El contacto no tiene un número de teléfono válido para esta acción.', color: 'warning' };
    }

    // 1. Limpieza y estandarización inicial: Eliminar todo lo que no sea dígito.
    let phoneNumber = phone.replace(/\D/g, '');

    // Si la limpieza deja un número vacío, detenemos la ejecución.
    if (!phoneNumber) {
        // ANTES: showSnackbar('El número de teléfono es inválido...', 'error');
        return { success: false, message: 'El número de teléfono es inválido después de la limpieza.', color: 'error' };
    }

    // ... (El resto de la lógica de normalización de números es igual) ...
    // Código de país local por defecto (Paraguay)
    const localCountryCode = '595';
    // Lista de prefijos móviles locales de 3 dígitos (para Paraguay)
    const localMobilePrefixes = ['97', '98', '96', '99']; 
    // Lista de prefijos internacionales comunes a mantener
    const internationalPrefixes = ['55', '54', '34'];

    // --- REGLAS DE NORMALIZACIÓN ---

    // 2. Regla 2: Reemplazar el '0' inicial con el código de país local (+595)
    if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.substring(1);
      phoneNumber = localCountryCode + phoneNumber;
    }
    
    // 3. Regla 1: Prefijos móviles locales (97, 98, 96, 99)
    const startsWithLocalMobilePrefix = localMobilePrefixes.some(prefix => phoneNumber.startsWith(prefix));

    if (startsWithLocalMobilePrefix && phoneNumber.length < 12) {
      if (!phoneNumber.startsWith(localCountryCode)) {
          phoneNumber = localCountryCode + phoneNumber;
      }
    }

    // 4. Regla 3: Prefijos Internacionales (Brasil, Argentina, España)
    const startsWithInternationalPrefix = internationalPrefixes.some(prefix => phoneNumber.startsWith(prefix));

    if (!startsWithInternationalPrefix && !phoneNumber.startsWith(localCountryCode) && phoneNumber.length > 8) {
      if (!startsWithLocalMobilePrefix) {
          phoneNumber = localCountryCode + phoneNumber;
      }
    }

    // La URL de WhatsApp requiere solo dígitos (sin el '+' inicial)
    const url = `https://wa.me/${phoneNumber}`;
    window.open(url, '_blank');
    
    // Retorna éxito, el padre decide si notifica la acción o es un silencio exitoso.
    return { success: true };
  };

  /**
   * Descarga una vCard (tarjeta de contacto).
   */
  const downloadVCard = (contact, contactPhones) => {
    const fullNames = contact.completo.split(' ');
    const firstName = fullNames[0] || '';
    const lastName = fullNames.slice(1).join(' ') || '';
    const phoneNumbers = contactPhones.map(p => `TEL;TYPE=${p.tipo}:${p.numero}`);
    
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contact.completo}`,
      `N:${lastName};${firstName};;;`,
      `X-ABUID:${contact.contact_cedula}`,
      ...(phoneNumbers.length > 0 ? phoneNumbers : []),
      'END:VCARD'
    ].join('\n');

    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${contact.completo.replace(/\s/g, '_')}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // ANTES: showSnackbar('vCard descargada.', 'success');
    return { success: true, message: 'vCard descargada con éxito.' };
  };

  /**
   * Usa la API Web Share para compartir un contacto.
   */
  const shareContact = (contact, contactPhones) => {
    if (navigator.share) {
      const phoneList = contactPhones.map(p => `${p.tipo}: ${p.numero}`).join(', ');
      return navigator.share({
        title: `Contacto de ${contact.completo}`,
        text: `Nombre: ${contact.completo}\nTeléfonos: ${phoneList || 'No hay teléfonos registrados.'}`,
      })
      .then(() => {
        // ANTES: showSnackbar('Contacto compartido con éxito.', 'success');
        return { success: true, message: 'Contacto compartido con éxito.' };
      })
      .catch((err) => {
        console.error('Error al compartir el contacto:', err);
        // ANTES: showSnackbar('Error al compartir el contacto.', 'error');
        return { success: false, message: 'Error al compartir el contacto.', errorObject: err };
      });
    } else {
      // ANTES: showSnackbar('La API Web Share no es compatible...', 'warning');
      return { success: false, message: 'La API Web Share no es compatible con este navegador.', color: 'warning' };
    }
  };

  return {
    openWhatsApp,
    downloadVCard,
    shareContact,
  };
}