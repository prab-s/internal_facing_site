import { redirect } from "@sveltejs/kit";
function load({ url }) {
  const query = url.searchParams.toString();
  throw redirect(307, `/cms${query ? `?${query}` : ""}`);
}
export {
  load
};
