// Light theme (white + muted blue). Colors mirror the design tokens in styles/main.css (the source of truth).
// Corners and shadows come from the main.css tokens: 8px cards, 6px controls, 4px labels.
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
          faint: '#617086',
          border: '#D9E2EC',
          'input-border': '#C3D0DE',
          success: '#187556',
          warning: '#8A5A08',
          error: '#C0392B',
          info: '#1F6FB8',
        },
      },
    },
  },
  defaults: {
    global: { rounded: 'md' },
    VBtn: { rounded: 'md', minHeight: 44, elevation: 0 },
    VCard: { rounded: 'md', elevation: 0 },
    VTextField: { variant: 'outlined', rounded: 'md' },
    VSelect: { variant: 'outlined', rounded: 'md' },
    VTextarea: { variant: 'outlined', rounded: 'md' },
    VFileInput: { variant: 'outlined', rounded: 'md' },
    VAlert: { rounded: 'md' },
    VDialog: { rounded: 'md' },
    VMenu: { rounded: 'md' },
    VListItem: { rounded: 0 },
    VChip: { rounded: 'md' },
    VTab: { rounded: 0 },
    VSnackbar: { color: 'on-surface', rounded: 'md' },
    VProgressLinear: { rounded: false },
  },
});
