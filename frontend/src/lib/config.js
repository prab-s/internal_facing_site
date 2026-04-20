import { browser } from '$app/environment';
import { writable } from 'svelte/store';
export { getChartTheme } from '$lib/chartTheme.js';

/**
 * Centralised API base URL. Change this for deployment (e.g. to relative /api or full URL).
 */
export const API_BASE = '/api';
const THEME_STORAGE_KEY = 'internal-facing-theme';

export const GLOBAL_UNIT_OPTIONS = [
  'A',
  'Hz',
  'kg',
  'kW',
  'L/s',
  'm3/h',
  'mm',
  'Pa',
  'RPM',
  'V',
  '°C'
];

export const MOUNTING_STYLE_OPTIONS = [
  'roof mounted',
  'inline'
];

export const DISCHARGE_TYPE_OPTIONS = [
  'vertical discharge',
  'side discharge'
];

export function emptyProductForm() {
  return {
    model: '',
    product_type_key: 'fan',
    series_id: null,
    series_name: '',
    template_id: 'product-default',
    mounting_style: '',
    discharge_type: '',
    description1_html: '',
    description2_html: '',
    description3_html: '',
    comments_html: '',
    show_rpm_band_shading: true,
    band_graph_background_color: '#ffffff',
    band_graph_label_text_color: '#000000'
  };
}

export const theme = writable('light');

export function applyTheme(nextTheme) {
  theme.set(nextTheme);
  if (browser) {
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }
}

export function initTheme() {
  if (!browser) return;
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  applyTheme(savedTheme);
}

export function toggleTheme(currentTheme) {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}
