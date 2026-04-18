import { h as head } from "../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Overview</p> <h1 class="h2 mb-2">Internal product data, records, and graph comparison in one place.</h1> <p class="text-body-secondary">Use the workspace to maintain product records, edit graph data, browse the catalogue, and review generated product graphs.</p></div></div> <div class="row g-3"><div class="col-12 col-lg-3"><div class="card shadow-sm h-100"><div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Create &amp; Edit</p> <h2 class="h4">Data Entry</h2> <p>Build product records, upload product images, manage graph lines, and edit performance points on tables and charts.</p> <button class="btn btn-primary align-self-start" type="button">Open Data Entry</button></div></div></div> <div class="col-12 col-lg-3"><div class="card shadow-sm h-100"><div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Search &amp; Compare</p> <h2 class="h4">Catalogue</h2> <p>Filter the library by product attributes and operating ranges, then compare graph data across selected products.</p> <button class="btn btn-primary align-self-start" type="button">Open Catalogue</button></div></div></div> <div class="col-12 col-lg-3"><div class="card shadow-sm h-100"><div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Review</p> <h2 class="h4">Graph View</h2> <p>Inspect line and overlay data for a single graph-capable product in a dedicated graph view.</p> <button class="btn btn-primary align-self-start" type="button">Open Graph View</button></div></div></div> <div class="col-12 col-lg-3"><div class="card shadow-sm h-100"><div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Account &amp; Admin</p> <h2 class="h4">Setup</h2> <p>Manage your password and, for admins, user accounts and access to the internal application.</p> <button class="btn btn-primary align-self-start" type="button">Open Setup</button></div></div></div></div>`);
  });
}
export {
  _page as default
};
