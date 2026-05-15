import { error } from '@sveltejs/kit';

export async function load({ fetch, url }) {
  const series = url.searchParams.get('series') || '';

  if (series) {
    const response = await fetch('/api/series');
    if (!response.ok) {
      throw error(response.status, 'Unable to load series.');
    }

    const seriesRecords = await response.json();
    if (!seriesRecords.some((seriesRecord) => String(seriesRecord.id) === String(series))) {
      throw error(404, 'Series not found.');
    }
  }

  return {
    series
  };
}
