import { c as create_ssr_component } from "../../chunks/ssr.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `${$$result.head += `<!-- HEAD_svelte-qxfj9n_START -->${$$result.title = `<title>Fan Graphs</title>`, ""}<!-- HEAD_svelte-qxfj9n_END -->`, ""} <div class="card"><h1 data-svelte-h="svelte-1hbxh5y">Fan Graphs</h1> <p data-svelte-h="svelte-hafouv">Compare fan performance curves and view fan maps. Use the navigation above.</p> <ul><li><button type="button" data-svelte-h="svelte-12qdxse">Data entry</button>
      — Create fans and add performance data points (including bulk CSV import).</li> <li><button type="button" data-svelte-h="svelte-141qr14">Catalogue</button>
      — Filter fans and overlay multiple performance curves for comparison.</li> <li><button type="button" data-svelte-h="svelte-1s0uch1">Fan map</button>
      — View flow vs pressure and efficiency for a single fan.</li></ul></div>`;
});
export {
  Page as default
};
