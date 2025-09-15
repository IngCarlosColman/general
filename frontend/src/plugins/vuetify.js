// src/plugins/vuetify.js

// Importaciones de estilos
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables de Vuetify
import { createVuetify } from 'vuetify'

// Importación de idiomas
import { es } from 'vuetify/locale'

export default createVuetify({
  // Configuración del idioma
  locale: {
    locale: 'es',
    fallback: 'en',
    messages: { es },
  },
  theme: {
    defaultTheme: 'system',
  },
})