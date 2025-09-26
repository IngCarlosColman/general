<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="600"
        persistent
        scrollable
    >
        <v-card :loading="saving">
            <v-card-title class="d-flex align-center text-white bg-blue-darken-1 border-b">
                <v-icon icon="mdi-account-edit" class="me-3" color="white"></v-icon>
                <span class="text-h5 font-weight-bold">Editar Registro</span>
                <v-spacer></v-spacer>
                <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('close')"></v-btn>
            </v-card-title>
            <v-card-text class="pt-4">
                <v-form ref="form">
                    <v-container class="pa-0">
                        <v-row dense>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="localItem.nombres"
                                    @update:model-value="val => localItem.nombres = val.toUpperCase()"
                                    label="Nombres"
                                    :rules="[v => !!v || 'El nombre es obligatorio']"
                                    density="compact"
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="localItem.apellidos"
                                    @update:model-value="val => localItem.apellidos = val.toUpperCase()"
                                    label="Apellidos"
                                    :rules="[v => !!v || 'El apellido es obligatorio']"
                                    density="compact"
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    :model-value="localItem.cedula"
                                    label="Cédula"
                                    :rules="[v => !!v || 'La cédula es obligatoria']"
                                    density="compact"
                                    readonly
                                    hint="La cédula no se puede modificar al editar."
                                    persistent-hint
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    label="Nombre Completo"
                                    :model-value="completo"
                                    readonly
                                    hide-details
                                    variant="solo-filled" density="compact"
                                    flat
                                ></v-text-field>
                            </v-col>
                            
                            <template v-if="selectedCategory === 'private-agenda'">
                                <v-col cols="12">
                                    <v-divider class="my-3"></v-divider>
                                    <p class="text-subtitle-1 font-weight-medium text-blue-grey-darken-2 mb-2">Detalles de Agenda</p>
                                </v-col>
                                <v-col cols="12" sm="6">
                                    <v-select
                                        v-model.number="localItem.categoria_id"
                                        :items="agendaCategories"
                                        item-title="nombre_categoria"
                                        item-value="id"
                                        label="Categoría de Agenda"
                                        clearable
                                        density="compact"
                                    ></v-select>
                                </v-col>
                                <v-col cols="12" sm="6">
                                    <v-textarea
                                        v-model="localItem.notas"
                                        @update:model-value="val => localItem.notas = val.toUpperCase()"
                                        label="Notas"
                                        rows="2"
                                        density="compact"
                                        hide-details
                                    ></v-textarea>
                                </v-col>
                            </template>

                            <v-col cols="12" v-if="isAdmin" class="pt-1">
                                <v-divider class="my-3"></v-divider>
                                <p class="text-subtitle-1 font-weight-medium text-blue-grey-darken-2 mb-2">Teléfonos de Contacto (Solo Admin)</p>
                                
                                <div v-for="(tel, index) in localItem.telefonos" :key="index" class="d-flex align-center mb-2">
                                    <v-text-field
                                        v-model="localItem.telefonos[index]"
                                        @update:model-value="val => localItem.telefonos[index] = val.replace(/\D/g, '')"
                                        label="Número de Teléfono Completo"
                                        hide-details
                                        density="compact"
                                        class="me-2"
                                        variant="outlined"
                                        type="tel"
                                        inputmode="numeric"
                                        :rules="[v => !!v || 'El número es obligatorio']"
                                    ></v-text-field>
                                    <v-btn
                                        icon="mdi-close-circle"
                                        size="x-small"
                                        color="red-darken-1"
                                        variant="text"
                                        @click="removeTelefono(index)"
                                        class="mt-0"
                                    ></v-btn>
                                </div>
                                <v-btn
                                    @click="addTelefono"
                                    prepend-icon="mdi-phone-plus"
                                    variant="tonal" color="blue-grey"
                                    size="small"
                                    class="mt-1"
                                >
                                    Añadir Teléfono
                                </v-btn>
                            </v-col>
                        </v-row>
                    </v-container>
                </v-form>
            </v-card-text>
            <v-card-actions class="bg-grey-lighten-4 pa-3 border-t">
                <v-spacer></v-spacer>
                <v-btn color="grey-darken-1" variant="text" @click="$emit('close')" :disabled="saving">
                    Cancelar
                </v-btn>
                <v-btn
                    color="blue-darken-1"
                    variant="flat"
                    @click="save"
                    :disabled="saving"
                >
                    Guardar
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<script setup>
import { computed, defineProps, defineEmits, ref, watch } from 'vue';

const props = defineProps({
    modelValue: { type: Boolean, required: true },
    editedItem: { type: Object, required: true },
    saving: { type: Boolean, default: false },
    selectedCategory: { type: String, required: true },
    agendaCategories: { type: Array, default: () => [] },
    currentUserRol: { type: String, required: true },
});

const emit = defineEmits(['update:modelValue', 'close', 'save']);
const form = ref(null);

// =========================================================
// 💡 CÓDIGOS DE PAÍS POR REGIÓN (ELIMINADOS)
// =========================================================

const isAdmin = computed(() => props.currentUserRol === 'administrador');

// **Estado local para la edición**
const localItem = ref({});

// Observa el prop 'editedItem' y lo clona.
watch(() => props.editedItem, (newItem) => {
    // Clonación profunda del ítem
    const clonedItem = JSON.parse(JSON.stringify(newItem));
    
    // Si es administrador, inicializamos 'telefonos' si no existe.
    // Los teléfonos se copian como un simple array de strings.
    if (isAdmin.value && !clonedItem.telefonos) {
        clonedItem.telefonos = [];
    }

    localItem.value = clonedItem;
}, { deep: true, immediate: true });

const completo = computed(() => {
    if (localItem.value.nombres || localItem.value.apellidos) {
        return `${(localItem.value.nombres || '').toUpperCase()} ${(localItem.value.apellidos || '').toUpperCase()}`.trim();
    }
    return '';
});

// Añade el teléfono como una simple cadena vacía
const addTelefono = () => {
    if (!localItem.value.telefonos) {
        localItem.value.telefonos = [];
    }
    // Añade una cadena de texto vacía para que el usuario ingrese el número completo.
    localItem.value.telefonos.push(''); 
};

const removeTelefono = (index) => {
    if (localItem.value.telefonos) {
        localItem.value.telefonos.splice(index, 1);
    }
};

const save = async () => {
    const { valid } = await form.value.validate();
    if (valid) {
        let telefonosToSave = props.editedItem.telefonos || []; // Valor por defecto: el array original

        if (isAdmin.value) {
            // Si es Admin, el teléfono es una cadena completa, solo filtramos y limpiamos.
            telefonosToSave = (localItem.value.telefonos || [])
                .map(tel => String(tel)) // Aseguramos que sea string
                .filter(tel => tel && tel.trim())
                .map(tel => tel.replace(/\D/g, '')); // Limpiamos solo para guardar
        }
        
        // Creamos el objeto final para guardar
        const itemToSave = {
            ...localItem.value,
            // Aseguramos que los campos obligatorios vayan en MAYÚSCULAS
            nombres: localItem.value.nombres ? localItem.value.nombres.toUpperCase() : '',
            apellidos: localItem.value.apellidos ? localItem.value.apellidos.toUpperCase() : '',
            cedula: localItem.value.cedula ? localItem.value.cedula.toUpperCase() : '',
            notas: localItem.value.notas ? localItem.value.notas.toUpperCase() : '',
            // Reemplazamos los teléfonos con el array de strings limpios
            telefonos: telefonosToSave 
        };

        emit('save', itemToSave);
    }
};
</script>