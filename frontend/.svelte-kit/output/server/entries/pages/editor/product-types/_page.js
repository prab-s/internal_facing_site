import { redirect } from "@sveltejs/kit";
function load() {
  throw redirect(307, "/editor/product-types/create");
}
export {
  load
};
