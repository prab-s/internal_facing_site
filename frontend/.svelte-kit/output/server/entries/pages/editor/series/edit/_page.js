function load({ url }) {
  return {
    series: url.searchParams.get("series") || ""
  };
}
export {
  load
};
