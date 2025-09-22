// src/utils/formatters.js

/**
 * Formatea un número a formato de moneda guaraní (PYG).
 * @param {number} value - El valor numérico a formatear.
 * @returns {string} - El valor formateado como una cadena de moneda.
 */
export function formatCurrencyPy(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formatea una cadena de fecha a un formato legible.
 * @param {string} dateString - La cadena de fecha a formatear.
 * @returns {string} - La fecha formateada o 'N/A' si no es válida.
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}
