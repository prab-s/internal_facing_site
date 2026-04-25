export const LIGHT_CHART_THEME = {
  background: '#ffffff',
  text: '#1e293b',
  grid: '#d7dde8',
  accent: '#2563eb',
  efficiency: '#15803d',
  permissible: '#dc2626',
  neutralLine: '#dddddd',
  fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif'
};

export const DARK_CHART_THEME = {
  background: '#1a1b26',
  text: '#c0caf5',
  grid: '#3b4261',
  accent: '#7aa2f7',
  efficiency: '#4ade80',
  permissible: '#f87171',
  neutralLine: '#dddddd',
  fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif'
};

export function getChartTheme(currentTheme) {
  return currentTheme === 'light' ? LIGHT_CHART_THEME : DARK_CHART_THEME;
}
