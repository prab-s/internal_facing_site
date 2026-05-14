export function load({ url }) {
  return {
    product_type: url.searchParams.get('product_type') || ''
  };
}
