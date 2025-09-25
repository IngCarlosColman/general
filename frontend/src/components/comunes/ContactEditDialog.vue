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
                                    <div class="d-flex flex-grow-1">
                                        <v-select
                                            v-model="tel.codigo"
                                            :items="countryCodes"
                                            item-title="name"
                                            item-value="code"
                                            label="Cód. País"
                                            density="compact"
                                            variant="outlined"
                                            class="me-2"
                                            style="max-width: 150px;"
                                            hide-details
                                            :rules="[v => !!v || '']"
                                        ></v-select>
                                        <v-text-field
                                            v-model="tel.numero"
                                            @update:model-value="val => tel.numero = val.replace(/\D/g, '')"
                                            label="Número"
                                            hide-details
                                            density="compact"
                                            class="me-2"
                                            variant="outlined"
                                            type="tel"
                                            inputmode="numeric"
                                            :rules="[v => !!v || 'El número es obligatorio']"
                                        ></v-text-field>
                                    </div>
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
// 💡 CÓDIGOS DE PAÍS POR REGIÓN, con PARAGUAY como referencia
// =========================================================
const americaCodes = [
    { code: '+595', name: '🇵🇾 Paraguay (+595)' }, // Referencia
    { code: '+1', name: '🇺🇸 Canadá/EE. UU. (+1)' },
    { code: '+52', name: '🇲🇽 México (+52)' },
    { code: '+54', name: '🇦🇷 Argentina (+54)' },
    { code: '+55', name: '🇧🇷 Brasil (+55)' },
    { code: '+56', name: '🇨🇱 Chile (+56)' },
    { code: '+57', name: '🇨🇴 Colombia (+57)' },
    { code: '+51', name: '🇵🇪 Perú (+51)' },
    { code: '+593', name: '🇪🇨 Ecuador (+593)' },
    { code: '+58', name: '🇻🇪 Venezuela (+58)' },
    { code: '+591', name: '🇧🇴 Bolivia (+591)' },
    { code: '+598', name: '🇺🇾 Uruguay (+598)' },
    { code: '+507', name: '🇵🇦 Panamá (+507)' },
    { code: '+506', name: '🇨🇷 Costa Rica (+506)' },
    { code: '+504', name: '🇭🇳 Honduras (+504)' },
    { code: '+503', name: '🇸🇻 El Salvador (+503)' },
    { code: '+502', name: '🇬🇹 Guatemala (+502)' },
    { code: '+505', name: '🇳🇮 Nicaragua (+505)' },
    { code: '+509', name: '🇭🇹 Haití (+509)' },
    { code: '+592', name: '🇬🇾 Guyana (+592)' },
    { code: '+597', name: '🇸🇷 Surinam (+597)' },
    { code: '+594', name: '🇬🇫 Guayana Francesa (+594)' },
    { code: '+1809', name: '🇩🇴 Rep. Dominicana (+1-809)' },
    { code: '+1876', name: '🇯🇲 Jamaica (+1-876)' },
    { code: '+1787', name: '🇵🇷 Puerto Rico (+1-787)' },
    { code: '+599', name: '🇨🇼 Curazao (+599)' },
    { code: '+501', name: '🇧🇿 Belice (+501)' },
    { code: '+1671', name: '🇬🇺 Guam (+1-671)' },
    { code: '+1242', name: '🇧🇸 Bahamas (+1-242)' },
    { code: '+1441', name: '🇧🇲 Bermudas (+1-441)' },
];
const europeCodes = [
    { code: '+49', name: '🇩🇪 Alemania (+49)' },
    { code: '+44', name: '🇬🇧 Reino Unido (+44)' },
    { code: '+33', name: '🇫🇷 Francia (+33)' },
    { code: '+34', name: '🇪🇸 España (+34)' },
    { code: '+39', name: '🇮🇹 Italia (+39)' },
    { code: '+31', name: '🇳🇱 Países Bajos (+31)' },
    { code: '+32', name: '🇧🇪 Bélgica (+32)' },
    { code: '+41', name: '🇨🇭 Suiza (+41)' },
    { code: '+46', name: '🇸🇪 Suecia (+46)' },
    { code: '+47', name: '🇳🇴 Noruega (+47)' },
    { code: '+48', name: '🇵🇱 Polonia (+48)' },
    { code: '+30', name: '🇬🇷 Grecia (+30)' },
    { code: '+351', name: '🇵🇹 Portugal (+351)' },
    { code: '+353', name: '🇮🇪 Irlanda (+353)' },
    { code: '+43', name: '🇦🇹 Austria (+43)' },
    { code: '+358', name: '🇫🇮 Finlandia (+358)' },
    { code: '+45', name: '🇩🇰 Dinamarca (+45)' },
    { code: '+36', name: '🇭🇺 Hungría (+36)' },
    { code: '+40', name: '🇷🇴 Rumania (+40)' },
    { code: '+420', name: '🇨🇿 Rep. Checa (+420)' },
    { code: '+7', name: '🇷🇺 Rusia (+7)' },
    { code: '+380', name: '🇺🇦 Ucrania (+380)' },
    { code: '+90', name: '🇹🇷 Turquía (+90)' },
    { code: '+355', name: '🇦🇱 Albania (+355)' },
    { code: '+359', name: '🇧🇬 Bulgaria (+359)' },
    { code: '+385', name: '🇭🇷 Croacia (+385)' },
    { code: '+381', name: '🇷🇸 Serbia (+381)' },
    { code: '+370', name: '🇱🇹 Lituania (+370)' },
    { code: '+371', name: '🇱🇻 Letonia (+371)' },
    { code: '+372', name: '🇪🇪 Estonia (+372)' },
];
const africaCodes = [
    { code: '+27', name: '🇿🇦 Sudáfrica (+27)' },
    { code: '+20', name: '🇪🇬 Egipto (+20)' },
    { code: '+234', name: '🇳🇬 Nigeria (+234)' },
    { code: '+254', name: '🇰🇪 Kenia (+254)' },
    { code: '+212', name: '🇲🇦 Marruecos (+212)' },
    { code: '+213', name: '🇩🇿 Argelia (+213)' },
    { code: '+216', name: '🇹🇳 Túnez (+216)' },
    { code: '+233', name: '🇬🇭 Ghana (+233)' },
    { code: '+243', name: '🇨🇩 R. D. Congo (+243)' },
    { code: '+251', name: '🇪🇹 Etiopía (+251)' },
    { code: '+255', name: '🇹🇿 Tanzania (+255)' },
    { code: '+263', name: '🇿🇼 Zimbabue (+263)' },
    { code: '+260', name: '🇿🇲 Zambia (+260)' },
    { code: '+264', name: '🇳🇦 Namibia (+264)' },
    { code: '+268', name: '🇸🇿 Eswatini (+268)' },
    { code: '+266', name: '🇱🇸 Lesoto (+266)' },
    { code: '+258', name: '🇲🇿 Mozambique (+258)' },
    { code: '+265', name: '🇲🇼 Malaui (+265)' },
    { code: '+244', name: '🇦🇴 Angola (+244)' },
    { code: '+245', name: '🇬🇼 Guinea-Bisáu (+245)' },
    { code: '+248', name: '🇸🇨 Seychelles (+248)' },
    { code: '+249', name: '🇸🇩 Sudán (+249)' },
    { code: '+250', name: '🇷🇼 Ruanda (+250)' },
    { code: '+220', name: '🇬🇲 Gambia (+220)' },
    { code: '+221', name: '🇸🇳 Senegal (+221)' },
    { code: '+222', name: '🇲🇷 Mauritania (+222)' },
    { code: '+223', name: '🇲🇱 Malí (+223)' },
    { code: '+224', name: '🇬🇳 Guinea (+224)' },
];
const asiaCodes = [
    { code: '+86', name: '🇨🇳 China (+86)' },
    { code: '+91', name: '🇮🇳 India (+91)' },
    { code: '+81', name: '🇯🇵 Japón (+81)' },
    { code: '+82', name: '🇰🇷 Corea del Sur (+82)' },
    { code: '+62', name: '🇮🇩 Indonesia (+62)' },
    { code: '+63', name: '🇵🇭 Filipinas (+63)' },
    { code: '+66', name: '🇹🇭 Tailandia (+66)' },
    { code: '+60', name: '🇲🇾 Malasia (+60)' },
    { code: '+971', name: '🇦🇪 Emiratos Árabes Unidos (+971)' },
    { code: '+966', name: '🇸🇦 Arabia Saudita (+966)' },
    { code: '+974', name: '🇶🇦 Catar (+974)' },
    { code: '+965', name: '🇰🇼 Kuwait (+965)' },
    { code: '+972', name: '🇮🇱 Israel (+972)' },
    { code: '+961', name: '🇱🇧 Líbano (+961)' },
    { code: '+977', name: '🇳🇵 Nepal (+977)' },
];
const oceaniaCodes = [
    { code: '+61', name: '🇦🇺 Australia (+61)' },
    { code: '+64', name: '🇳🇿 Nueva Zelanda (+64)' },
    { code: '+679', name: '🇫🇯 Fiyi (+679)' },
];

// COMBINACIÓN Y FILTRADO para asegurar que Paraguay esté al inicio
const countryCodesTemp = [
    ...americaCodes.filter(c => c.code === '+595'),
    ...americaCodes.filter(c => c.code !== '+595').sort((a, b) => a.name.localeCompare(b.name)),
    ...europeCodes.sort((a, b) => a.name.localeCompare(b.name)),
    ...africaCodes.sort((a, b) => a.name.localeCompare(b.name)),
    ...asiaCodes.sort((a, b) => a.name.localeCompare(b.name)),
    ...oceaniaCodes.sort((a, b) => a.name.localeCompare(b.name)),
];

const countryCodes = countryCodesTemp.filter((c, index, self) =>
    index === self.findIndex((t) => (
        t.code === c.code
    ))
);

// =========================================================
// 💡 LÓGICA DEL COMPONENTE (AJUSTADA)
// =========================================================

const isAdmin = computed(() => props.currentUserRol === 'administrador');

// Función para desglosar el teléfono (e.g., "+595973520528" -> {codigo: "+595", numero: "973520528"})
const parseTelefono = (fullNumber) => {
    if (!fullNumber) return { codigo: '+595', numero: '' };

    // Buscamos un código de país conocido que sea un prefijo del número completo
    const matchedCode = countryCodes.find(c => fullNumber.startsWith(c.code));

    if (matchedCode) {
        return {
            codigo: matchedCode.code,
            numero: fullNumber.substring(matchedCode.code.length),
        };
    }

    // Si no encontramos un código, asumimos Paraguay por defecto y el número completo como número.
    return { codigo: '+595', numero: fullNumber.replace(/\D/g, '') };
};

// **Estado local para la edición**
const localItem = ref({});

// Observa el prop 'editedItem' y lo clona, además de DESGLOSAR los teléfonos.
watch(() => props.editedItem, (newItem) => {
    // Clonación profunda del ítem
    const clonedItem = JSON.parse(JSON.stringify(newItem));
    
    // Si es administrador y hay teléfonos, los desglosamos para el formulario
    if (isAdmin.value && Array.isArray(clonedItem.telefonos)) {
        clonedItem.telefonos = clonedItem.telefonos.map(parseTelefono);
    } else if (isAdmin.value && !clonedItem.telefonos) {
        // Inicializamos como array vacío para el admin si no viene
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

// Añade el teléfono como OBJETO {codigo, numero} con Paraguay por defecto
const addTelefono = () => {
    if (!localItem.value.telefonos) {
        localItem.value.telefonos = [];
    }
    // Establece Paraguay (+595) como código por defecto y campo 'numero' vacío
    localItem.value.telefonos.push({ codigo: '+595', numero: '' });
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
            // Si es Admin, procesamos la concatenación de los objetos {codigo, numero}
            telefonosToSave = (localItem.value.telefonos || [])
                .filter(tel => tel.numero && tel.numero.trim() && tel.codigo && tel.codigo.trim())
                .map(tel => {
                    const codigo = tel.codigo.trim();
                    const numeroLimpio = tel.numero.replace(/\D/g, '');
                    return codigo + numeroLimpio; // Concatenación: "+595" + "973520528"
                });
        }
        
        // Creamos el objeto final para guardar
        const itemToSave = {
            ...localItem.value,
            // Aseguramos que los campos obligatorios vayan en MAYÚSCULAS
            nombres: localItem.value.nombres ? localItem.value.nombres.toUpperCase() : '',
            apellidos: localItem.value.apellidos ? localItem.value.apellidos.toUpperCase() : '',
            cedula: localItem.value.cedula ? localItem.value.cedula.toUpperCase() : '',
            notas: localItem.value.notas ? localItem.value.notas.toUpperCase() : '',
            // Reemplazamos los teléfonos con el array de strings concatenados para el backend
            telefonos: telefonosToSave 
        };

        emit('save', itemToSave);
    }
};
</script>