// src/composables/useContactUtilities.js

import { useSnackbar } from './useSnackbar';

/**
 * Composible para manejar acciones de utilidad relacionadas con contactos
 * que no pertenecen a la lógica de la agenda personal.
 * @returns {object} - Un objeto con los métodos de utilidad.
 */
export function useContactUtilities() {
  const { showSnackbar } = useSnackbar();

  /**
   * Abre la aplicación de WhatsApp para enviar un mensaje a un contacto.
   * @param {object} contact - El objeto del contacto de la agenda.
   * @param {string} phone - El número de teléfono específico a usar.
   */
  const openWhatsApp = (contact, phone) => {
    if (phone) {
      const phoneNumber = phone.replace(/\D/g, '');
      const url = `https://wa.me/${phoneNumber}`;
      window.open(url, '_blank');
    } else {
      showSnackbar('El contacto no tiene un número de teléfono válido para esta acción.', 'warning');
    }
  };

  /**
   * Descarga una vCard (tarjeta de contacto) para un contacto.
   * @param {object} contact - El objeto del contacto de la agenda.
   * @param {Array} contactPhones - Array de objetos de teléfono del store.
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
    showSnackbar('vCard descargada.', 'success');
  };

  /**
   * Usa la API Web Share para compartir un contacto.
   * @param {object} contact - El objeto del contacto de la agenda.
   * @param {Array} contactPhones - Array de objetos de teléfono del store.
   */
  const shareContact = (contact, contactPhones) => {
    if (navigator.share) {
      const phoneList = contactPhones.map(p => `${p.tipo}: ${p.numero}`).join(', ');
      navigator.share({
        title: `Contacto de ${contact.completo}`,
        text: `Nombre: ${contact.completo}\nTeléfonos: ${phoneList || 'No hay teléfonos registrados.'}`,
      })
      .then(() => {
        showSnackbar('Contacto compartido con éxito.', 'success');
      })
      .catch((err) => {
        console.error('Error al compartir el contacto:', err);
        showSnackbar('Error al compartir el contacto.', 'error');
      });
    } else {
      showSnackbar('La API Web Share no es compatible con este navegador.', 'warning');
    }
  };

  return {
    openWhatsApp,
    downloadVCard,
    shareContact,
  };
}