// src/composables/useSnackbar.js

import { ref } from 'vue';

const snackbarState = ref({
  show: false,
  message: '',
  color: 'success',
  timeout: 3000,
});

export function useSnackbar() {
  const showSnackbar = (message, color = 'success', timeout = 3000) => {
    snackbarState.value.show = true;
    snackbarState.value.message = message;
    snackbarState.value.color = color;
    snackbarState.value.timeout = timeout;
  };

  const closeSnackbar = () => {
    snackbarState.value.show = false;
  };

  return {
    snackbarState,
    showSnackbar,
    closeSnackbar,
  };
}