function load({ url }) {
  return {
    tab: url.searchParams.get("tab") || "",
    product: url.searchParams.get("product") || "",
    product_type: url.searchParams.get("product_type") || "",
    series: url.searchParams.get("series") || ""
  };
}
export {
  load
};
