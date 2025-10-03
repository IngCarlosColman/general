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
    // 1. Establecemos el tema por defecto en 'light' (o 'dark') 
    //    para asegurar que se apliquen los colores definidos a continuación.
    //    Si usas 'system', los colores solo se aplican si el sistema está en modo 'light'.
    defaultTheme: 'light', 
    themes: {
      light: {
        colors: {
          // 2. PALETA DE MATERIAL DASHBOARD (Purple 500 y colores de alerta)
          
          // Color Primary: Purple 500 (#9C27B0)
          primary: '#9C27B0', 
          
          // Color Secondary: Purple 700 (Un color más oscuro, común para hover/active)
          secondary: '#7B1FA2', 
          
          // Colores de alerta y feedback basados en el tema original:
          error: '#F44336',    // Red 500 ($brand-danger)
          info: '#00BCD4',     // Cyan 500 ($brand-info)
          success: '#4CAF50',  // Green 500 ($brand-success)
          warning: '#FF9800',  // Orange 500 ($brand-warning)
          
          // Puedes añadir 'rose' para tenerlo disponible como color personalizado
          rose: '#e91e63',
          
          // Fondo del layout principal (generalmente un gris muy claro)
          background: '#FAFAFA', 
          surface: '#FFFFFF',
        },
      },
      // Si planeas soportar el tema oscuro, puedes definir una paleta 'dark'
      // dark: {
      //   colors: {
      //     primary: '#AB47BC', // Purple 400
      //     // ...
      //   }
      // }
    },
  },
})