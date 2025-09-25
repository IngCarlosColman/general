<template>
  <v-card-text class="pa-0">
    <v-data-table-server
      :headers="headers"
      :items="items"
      :items-length="itemsLength"
      :loading="loading"
      :items-per-page="options.itemsPerPage"
      :page="options.page"
      :sort-by="options.sortBy"
      @update:items-per-page="$emit('update:options', { ...options, itemsPerPage: $event })"
      @update:page="$emit('update:options', { ...options, page: $event })"
      @update:sort-by="$emit('update:options', { ...options, sortBy: $event })"
      loading-text="Cargando datos..."
      no-data-text="No se encontraron resultados. Realice una búsqueda."
      :items-per-page-options="[
        { value: 10, title: '10' },
        { value: 25, title: '25' },
        { value: 50, title: '50' },
        { value: 100, title: '100' }
      ]"
    >
      <template v-slot:item.salario="{ item }">
        {{ formatCurrencyPy(item.salario) }}
      </template>

      <template v-slot:item.telefonos="{ item }">
        <v-chip-group>
          <v-chip v-for="tel in item.telefonos" :key="tel" size="small">
            {{ tel }}
          </v-chip>
        </v-chip-group>
      </template>

      <template v-slot:item.actions="{ item }">
        <v-tooltip :text="isAddedToPrivateAgenda(item.cedula) ? 'Eliminar de mi agenda' : 'Añadir a mi agenda'" location="top">
          <template v-slot:activator="{ props }">
            <v-icon
              size="small"
              class="me-2"
              @click="$emit('toggle-private-agenda', item)"
              :color="isAddedToPrivateAgenda(item.cedula) ? 'orange' : 'grey'"
              v-bind="props"
            >
              {{ isAddedToPrivateAgenda(item.cedula) ? 'mdi-star' : 'mdi-star-outline' }}
            </v-icon>
          </template>
        </v-tooltip>

        <v-tooltip text="Compartir contacto" location="top" v-if="item.telefonos?.length">
          <template v-slot:activator="{ props }">
            <v-icon
              size="small"
              class="me-2"
              @click="$emit('share-contact', item)"
              color="teal"
              v-bind="props"
            >
              mdi-share-variant
            </v-icon>
          </template>
        </v-tooltip>

        <v-tooltip text="Enviar mensaje de WhatsApp" location="top" v-if="item.telefonos?.length">
          <template v-slot:activator="{ props }">
            <v-icon
              size="small"
              class="me-2"
              @click="$emit('open-whatsapp', item, item.telefonos[0])" 
              color="green-lighten-1"
              v-bind="props"
            >
              mdi-whatsapp
            </v-icon>
          </template>
        </v-tooltip>

        <v-tooltip text="Editar" location="top">
          <template v-slot:activator="{ props }">
            <v-icon
              size="small"
              class="me-2"
              @click="$emit('edit', item)"
              color="blue"
              v-bind="props"
              v-if="canAccess(item)"
            >
              mdi-pencil
            </v-icon>
          </template>
        </v-tooltip>

        <v-tooltip text="Eliminar" location="top">
          <template v-slot:activator="{ props }">
            <v-icon
              size="small"
              @click="$emit('delete', item)"
              color="red"
              v-bind="props"
              v-if="canAccess(item)"
            >
              mdi-delete
            </v-icon>
          </template>
        </v-tooltip>
      </template>
    </v-data-table-server>
  </v-card-text>
</template>

<script setup>
import { computed } from 'vue';
import { formatCurrencyPy } from '@/utils/formatters';

const props = defineProps({
  headers: {
    type: Array,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
  itemsLength: {
    type: Number,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Object,
    required: true,
  },
  privateAgendaCedulas: {
    type: Array,
    default: () => [],
  },
  // 🔑 PROPS DE PERMISOS
  currentUserId: {
    type: [Number, String],
    required: true,
  },
  currentUserRol: {
    type: String,
    required: true,
  },
  // 🎯 NUEVA PROP REQUERIDA PARA LA LÓGICA DE VISUALIZACIÓN
  selectedCategory: {
    type: String,
    required: true,
  },
});

const emit = defineEmits([
  'update:options',
  'toggle-private-agenda',
  'share-contact',
  'open-whatsapp',
  // ❌ ELIMINADO: 'download-vcard',
  'edit',
  'delete',
]);

const isAddedToPrivateAgenda = (cedula) => {
  return props.privateAgendaCedulas.includes(cedula);
};

/**
 * Determina si el usuario logueado (administrador o editor) puede
 * realizar acciones de edición o eliminación en un item.
 * @param {object} item - El objeto de contacto.
 * @returns {boolean} - true si el usuario tiene permiso, false en caso contrario.
 */
const canAccess = (item) => {
  // 1. Regla: El Administrador tiene acceso total, independientemente de la categoría.
  if (props.currentUserRol === 'administrador') {
    return true;
  }
  
  // 2. Regla: La Guía General (otras categorías) es Read-Only para el Editor.
  if (props.selectedCategory !== 'private-agenda') {
    return false;
  }

  // A partir de aquí, sabemos que la categoría es 'private-agenda' y el usuario NO es Administrador.

  // 3. Regla: El Editor solo puede editar/eliminar sus propios registros de la agenda privada.
  if (props.currentUserRol === 'editor') {
    // Retorna true solo si el ID del creador coincide con el ID del usuario actual.
    return item.created_by == props.currentUserId;
  }

  // 4. Por defecto (otros roles en la agenda privada), no tiene acceso.
  return false;
};
</script>