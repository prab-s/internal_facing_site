import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/**
 * Centralised API base URL. Change this for deployment (e.g. to relative /api or full URL).
 */
export const API_BASE = '/api';
const THEME_STORAGE_KEY = 'fan-graphs-theme';

export const MOUNTING_STYLE_OPTIONS = [
  'roof mounted',
  'inline'
];

export const DISCHARGE_TYPE_OPTIONS = [
  'vertical discharge',
  'side discharge'
];

export function emptyFanForm() {
  return {
    model: '',
    notes: '',
    mounting_style: '',
    discharge_type: '',
    show_rpm_band_shading: true,
    band_graph_background_color: '#ffffff',
    band_graph_label_text_color: '#000000',
    diameter_mm: '',
    max_rpm: ''
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

export function getChartTheme(currentTheme) {
  if (currentTheme === 'light') {
    return {
      background: '#ffffff',
      text: '#1e293b',
      grid: '#d7dde8',
      accent: '#2563eb',
      efficiency: '#15803d',
      permissible: '#dc2626',
      neutralLine: '#6b7280'
    };
  }

  return {
    background: '#1a1b26',
    text: '#c0caf5',
    grid: '#3b4261',
    accent: '#7aa2f7',
    efficiency: '#4ade80',
    permissible: '#f87171',
    neutralLine: '#9ca3af'
  };
}
