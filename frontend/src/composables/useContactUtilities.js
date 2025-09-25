import { ref, watch, computed } from 'vue'; 
export function useContactUtilities() {
  const openWhatsApp = (contact, phone) => {
    if (!phone) {
      return { success: false, message: 'El contacto no tiene un número de teléfono válido para esta acción.', color: 'warning' };
    }
    let phoneNumber = phone.replace(/\D/g, '');
    if (!phoneNumber) {
      return { success: false, message: 'El número de teléfono es inválido después de la limpieza.', color: 'error' };
    }
    const localCountryCode = '595';
    const localMobilePrefixes = ['97', '98', '96', '99']; 
    const internationalPrefixes = ['55', '54', '34'];
    if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.substring(1);
      phoneNumber = localCountryCode + phoneNumber;
    }
    const startsWithLocalMobilePrefix = localMobilePrefixes.some(prefix => phoneNumber.startsWith(prefix));
    if (startsWithLocalMobilePrefix && phoneNumber.length < 12) {
      if (!phoneNumber.startsWith(localCountryCode)) {
          phoneNumber = localCountryCode + phoneNumber;
      }
    }
    const startsWithInternationalPrefix = internationalPrefixes.some(prefix => phoneNumber.startsWith(prefix));
    if (!startsWithInternationalPrefix && !phoneNumber.startsWith(localCountryCode) && phoneNumber.length > 8) {
      if (!startsWithLocalMobilePrefix) {
          phoneNumber = localCountryCode + phoneNumber;
      }
    }
    const url = `https://wa.me/${phoneNumber}`;
    window.open(url, '_blank');
    return { success: true };
  };
  const shareContact = (contact, contactPhones) => {
    if (navigator.share) {
      const phoneList = contactPhones.map(p => `${p.tipo}: ${p.numero}`).join(', ');
      return navigator.share({
        title: `Contacto de ${contact.completo}`,
        text: `Nombre: ${contact.completo}\nTeléfonos: ${phoneList || 'No hay teléfonos registrados.'}`,
      })
      .then(() => {
        return { success: true, message: 'Contacto compartido con éxito.' };
      })
      .catch((err) => {
        console.error('Error al compartir el contacto:', err);
        return { success: false, message: 'Error al compartir el contacto.', errorObject: err };
      });
    } else {
      return { success: false, message: 'La API Web Share no es compatible con este navegador.', color: 'warning' };
    }
  };
  return {
    openWhatsApp,
    shareContact,
  };
}