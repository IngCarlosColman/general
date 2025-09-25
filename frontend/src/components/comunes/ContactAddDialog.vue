<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="600"
        persistent
        scrollable >
        <v-card :loading="saving">
            <v-card-title class="d-flex align-center text-blue-grey-darken-3 bg-grey-lighten-4 border-b">
                <v-icon icon="mdi-account-plus" class="me-3" color="green-darken-1"></v-icon>
                <span class="text-h6 font-weight-bold">
                    {{ editedItem.id ? 'Editar Contacto' : 'Nuevo Contacto' }} </span>
                <v-spacer></v-spacer>
                <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('close')"></v-btn>
            </v-card-title>

            <v-card-text class="pt-4">
                <v-form ref="form">
                    <v-container class="pa-0">
                        <v-row dense> 
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    :model-value="editedItem.nombres"
                                    @update:model-value="val => editedItem.nombres = val.toUpperCase()" label="Nombres"
                                    :rules="[v => !!v || 'El nombre es obligatorio']"
                                    density="compact"
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    :model-value="editedItem.apellidos"
                                    @update:model-value="val => editedItem.apellidos = val.toUpperCase()" label="Apellidos"
                                    :rules="[v => !!v || 'El apellido es obligatorio']"
                                    density="compact"
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    :model-value="editedItem.cedula"
                                    @update:model-value="val => editedItem.cedula = val.toUpperCase()" label="Cédula"
                                    :rules="[v => !!v || 'La cédula es obligatoria']"
                                    density="compact"
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
                                    class="pt-1"
                                ></v-text-field>
                            </v-col>

                            <template v-if="selectedCategory === 'private-agenda'">
                                <v-col cols="12">
                                    <v-divider class="my-3"></v-divider>
                                    <p class="text-subtitle-1 font-weight-medium text-blue-grey-darken-2 mb-2">Detalles de Agenda</p>
                                </v-col>
                                <v-col cols="12" sm="6">
                                    <v-select
                                        v-model.number="editedItem.categoria_id"
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
                                        :model-value="editedItem.notas"
                                        @update:model-value="val => editedItem.notas = val.toUpperCase()" label="Notas"
                                        rows="2"
                                        density="compact"
                                        hide-details
                                    ></v-textarea>
                                </v-col>
                            </template>

                            <v-col cols="12" class="pt-1">
                                <v-divider class="my-3"></v-divider>
                                <p class="text-subtitle-1 font-weight-medium text-blue-grey-darken-2 mb-2">Teléfonos de Contacto</p>

                                <div v-for="(tel, index) in editedItem.telefonos" :key="index" class="d-flex align-center mb-2">
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
                    color="green-darken-1"
                    variant="flat"
                    @click="save"
                    :disabled="saving"
                >
                    Guardar Contacto
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { computed, defineProps, defineEmits, ref } from 'vue';

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
    { code: '+246', name: '🇮🇴 Territorio Británico del Océano Índico (+246)' },
    { code: '+247', name: '🇸🇭 Santa Helena, Ascensión y Tristán de Acuña (+247)' },
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
    // Aseguramos que Paraguay esté al principio
    ...americaCodes.filter(c => c.code === '+595'), 
    
    // Agregamos y ordenamos el resto de códigos, filtrando Paraguay para evitar duplicados en la lista
    ...americaCodes.filter(c => c.code !== '+595').sort((a, b) => a.name.localeCompare(b.name)),
    ...europeCodes.sort((a, b) => a.name.localeCompare(b.name)),
    ...africaCodes.sort((a, b) => a.name.localeCompare(b.name)),
    ...asiaCodes.sort((a, b) => a.name.localeCompare(b.name)),
    ...oceaniaCodes.sort((a, b) => a.name.localeCompare(b.name)),
];
// Quitamos los duplicados finales
const countryCodes = countryCodesTemp.filter((c, index, self) => 
    index === self.findIndex((t) => (
        t.code === c.code 
    ))
);


const completo = computed(() => {
    if (props.editedItem.nombres || props.editedItem.apellidos) {
        return `${props.editedItem.nombres || ''} ${props.editedItem.apellidos || ''}`.trim();
    }
    return '';
});

// FUNCIÓN MODIFICADA: Añade el código de Paraguay por defecto
const addTelefono = () => {
    if (!props.editedItem.telefonos) {
        props.editedItem.telefonos = [];
    }
    // Establece Paraguay (+595) como código por defecto
    props.editedItem.telefonos.push({ codigo: '+595', numero: '' });
};

const removeTelefono = (index) => {
    props.editedItem.telefonos.splice(index, 1);
};

const save = async () => {
    const { valid } = await form.value.validate();
    if (valid) {
        // 💡 CONCATENACIÓN: Transforma el array de objetos {codigo, numero} en un array de strings "+codigonumero"
        const concatenatedTelefonos = (props.editedItem.telefonos || [])
            .filter(tel => tel.numero && tel.numero.trim()) // Solo si tiene número
            .map(tel => {
                const codigo = tel.codigo || '';
                // Aseguramos que solo contenga números y luego concatenamos
                const numeroLimpio = tel.numero ? tel.numero.replace(/\D/g, '') : '';
                return codigo + numeroLimpio; // Ejemplo: "+595" + "973520528"
            });

        const itemToSave = {
            ...props.editedItem,
            // Conversión a mayúsculas para Nombres/Apellidos/Cédula/Notas
            nombres: props.editedItem.nombres ? props.editedItem.nombres.toUpperCase() : '',
            apellidos: props.editedItem.apellidos ? props.editedItem.apellidos.toUpperCase() : '',
            cedula: props.editedItem.cedula ? props.editedItem.cedula.toUpperCase() : '',
            notas: props.editedItem.notas ? props.editedItem.notas.toUpperCase() : '',
            
            // Usamos el array de strings concatenados
            telefonos: concatenatedTelefonos
        };

        emit('save', itemToSave);
    }
};
</script>