import { error } from "@sveltejs/kit";
async function load({ fetch, url }) {
  const product_type = url.searchParams.get("product_type") || "";
  if (product_type) {
    const response = await fetch("/api/product-types");
    if (!response.ok) {
      throw error(response.status, "Unable to load product types.");
    }
    const productTypes = await response.json();
    if (!productTypes.some((productType) => String(productType.id) === String(product_type))) {
      throw error(404, "Product type not found.");
    }
  }
  return {
    product_type
  };
}
export {
  load
};
