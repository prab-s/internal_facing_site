export function load({ url }) {
  return {
    product: url.searchParams.get('product') || ''
  };
}
