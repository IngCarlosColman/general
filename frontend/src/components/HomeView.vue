<template>
  <v-container fluid class="pa-0">
    <v-card>
      <v-tabs v-model="tab" color="primary" align-tabs="start">
        <v-tab value="agenda">
          <v-icon start>mdi-account-box-multiple</v-icon>
          Mi Agenda Privada
        </v-tab>
        <v-tab value="seguimiento">
          <v-icon start>mdi-heart-plus</v-icon>
          Acompañamiento y Seguimiento
        </v-tab>
      </v-tabs>

      <v-divider></v-divider>

      <v-window v-model="tab">
        <v-window-item value="agenda">
          <user-agenda></user-agenda>
        </v-window-item>

        <v-window-item value="seguimiento">
          <follow-up></follow-up>
        </v-window-item>
      </v-window>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import UserAgenda from '@/components/UserAgenda.vue';
import FollowUp from '@/components/FollowUp.vue';

const tab = ref(null);
</script>