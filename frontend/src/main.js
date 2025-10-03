/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

// Styles
import 'unfonts.css'
// 👉 IMPORTA AQUÍ TU ARCHIVO SCSS PRINCIPAL PARA APLICAR EL TEMA GLOBAL
import '@/styles/material-dashboard-theme/master.scss' 

const app = createApp(App)

registerPlugins(app)

app.mount('#app')