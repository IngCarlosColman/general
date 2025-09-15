import { reactive, readonly } from 'vue';

const state = reactive({
  snackbar: false,
  text: '',
  color: '',
});

export function useSnackbar() {
  const showSnackbar = (text, color = 'success') => {
    state.text = text;
    state.color = color;
    state.snackbar = true;
  };

  const closeSnackbar = () => {
    state.snackbar = false;
  };

  return {
    snackbarState: readonly(state),
    showSnackbar,
    closeSnackbar,
  };
}