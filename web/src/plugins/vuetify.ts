// Light theme from the client's mockup (white + blue). 6px cards, 4px controls, 3px labels, light shadows.
// Tokens mirrored in styles/main.css.
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'otLight',
    themes: {
      otLight: {
        dark: false,
        colors: {
          background: '#F4F7FB', // page ground (light blue-grey)
          surface: '#FFFFFF', // cards, tables, panels
          'surface-bright': '#F8FAFD', // footer, sidebars, raised blocks
          'surface-variant': '#F8FAFD',
          'on-surface-variant': '#14213D',
          'on-surface-bright': '#14213D',
          primary: '#1F6FB8',
          'on-primary': '#FFFFFF',
          'primary-tint': '#E6F0FA',
          'on-primary-tint': '#17599A',
          'on-background': '#14213D',
          'on-surface': '#14213D',
          muted: '#5B6B7F',
          border: '#D9E2EC',
          'input-border': '#C3D0DE',
          success: '#1E8A66',
          warning: '#9A6409',
          error: '#C0392B',
          info: '#1F6FB8',
        },
      },
    },
  },
  defaults: {
    global: { rounded: 'sm' },
    VBtn: { rounded: 'sm', minHeight: 44, elevation: 0 },
    VCard: { rounded: 'sm', elevation: 0 },
    VTextField: { variant: 'outlined', rounded: 'sm' },
    VSelect: { variant: 'outlined', rounded: 'sm' },
    VTextarea: { variant: 'outlined', rounded: 'sm' },
    VFileInput: { variant: 'outlined', rounded: 'sm' },
    VAlert: { rounded: 'sm' },
    VDialog: { rounded: 'sm' },
    VMenu: { rounded: 'sm' },
    VListItem: { rounded: 0 },
    VChip: { rounded: 'sm' },
    VTab: { rounded: 0 },
    VSnackbar: { color: 'on-surface', rounded: 'sm' },
    VProgressLinear: { rounded: false },
  },
});
