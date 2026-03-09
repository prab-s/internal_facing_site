import { c as create_ssr_component } from "../../chunks/ssr.js";
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<nav class="nav" data-svelte-h="svelte-9p14ew"><a href="/">Home</a> <a href="/entry">Data entry</a> <a href="/catalogue">Catalogue</a> <a href="/map">Fan map</a></nav> <main>${slots.default ? slots.default({}) : ``}</main>`;
});
export {
  Layout as default
};
