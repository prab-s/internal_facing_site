import { f as fallback, e as escape_html, i as ensure_array_like, d as bind_props } from "./index2.js";
function SeriesNamesBadgeList($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let seriesNames = fallback($$props["seriesNames"], () => [], true);
    let title = fallback($$props["title"], "Series names");
    let emptyLabel = fallback($$props["emptyLabel"], "No series names available.");
    $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><h3 class="h6 mb-3">${escape_html(title)}</h3> `);
    if (seriesNames?.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="d-flex flex-wrap gap-2"><!--[-->`);
      const each_array = ensure_array_like(seriesNames);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let seriesName = each_array[$$index];
        $$renderer2.push(`<span class="badge text-bg-light border">${escape_html(seriesName)}</span>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="text-body-secondary mb-0">${escape_html(emptyLabel)}</p>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    bind_props($$props, { seriesNames, title, emptyLabel });
  });
}
export {
  SeriesNamesBadgeList as S
};
