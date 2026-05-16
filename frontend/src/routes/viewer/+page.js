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
    const resolvedProductType = productTypes.find(
      (productType) => String(productType.id) === String(product_type) || String(productType.key) === String(product_type)
    );
    if (!resolvedProductType) {
      throw error(404, 'Product type not found.');
    }

    let productTypeContext = null;
    try {
      const contextResponse = await fetch(`/api/product-types/${encodeURIComponent(resolvedProductType.id)}/pdf-context`);
      if (contextResponse.ok) {
        productTypeContext = await contextResponse.json();
      }
    } catch {
      productTypeContext = null;
    }

    return {
      tab,
      product,
      product_type,
      product_type_id: String(resolvedProductType.id),
      product_type_key: resolvedProductType.key,
      product_type_context: productTypeContext,
      series
    };
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
    product_type_id: product_type,
    product_type_key: '',
    product_type_context: null,
    series
  };
}
