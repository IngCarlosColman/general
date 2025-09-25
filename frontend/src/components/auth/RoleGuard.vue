<template>
    <slot v-if="hasRequiredRole"></slot>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
    // Recibe un array de roles permitidos (ej: ['administrador', 'editor'])
    allowedRoles: {
        type: Array,
        required: true,
    }
});

const authStore = useAuthStore();

// Propiedad computada que verifica la autorización
const hasRequiredRole = computed(() => {
    // Si la lista de roles permitidos incluye el rol actual del usuario
    return props.allowedRoles.includes(authStore.rol);
});
</script>
