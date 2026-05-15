import { error } from '@sveltejs/kit';

export async function load({ fetch, url }) {
  const tab = url.searchParams.get('tab') || '';
  const product = url.searchParams.get('product') || '';
  const product_type = url.searchParams.get('product_type') || '';
  const series = url.searchParams.get('series') || '';

  if (tab === 'product' && product) {
    const response = await fetch(`/api/products/${encodeURIComponent(product)}`);
    if (!response.ok) {
      throw error(response.status === 404 ? 404 : response.status, 'Product not found.');
    }
  }

  if (tab === 'product-type' && product_type) {
    const response = await fetch('/api/product-types');
    if (!response.ok) {
      throw error(response.status, 'Unable to load product types.');
    }

    const productTypes = await response.json();
    if (!productTypes.some((productType) => String(productType.id) === String(product_type))) {
      throw error(404, 'Product type not found.');
    }
  }

  if (tab === 'series' && series) {
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
    tab,
    product,
    product_type,
    series
  };
}
