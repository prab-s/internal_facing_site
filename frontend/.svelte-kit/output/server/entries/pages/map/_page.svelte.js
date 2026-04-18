import { s as store_get, h as head, d as ensure_array_like, e as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { g as getFans, c as getChartTheme, t as theme, a as getFanChartData, h as getFan } from "../../../chunks/api.js";
import { E as ECharts } from "../../../chunks/ECharts.js";
import { b as buildFullChartOption } from "../../../chunks/fullChart.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let fans = [];
    let selectedFanId = null;
    let rpmLines = [];
    let rpmPoints = [];
    let efficiencyPoints = [];
    let currentFan = null;
    let chartOption = {};
    let loading = false;
    let error = "";
    async function loadFans() {
      try {
        fans = await getFans();
        if (fans.length && !selectedFanId) selectedFanId = fans[0].id;
      } catch (e) {
        error = e.message;
      }
    }
    async function loadMap() {
      if (!selectedFanId) return;
      loading = true;
      error = "";
      try {
        const [chartData, fan] = await Promise.all([getFanChartData(selectedFanId), getFan(selectedFanId)]);
        ({ rpmLines, rpmPoints, efficiencyPoints } = chartData);
        currentFan = fan;
        buildChartOptions();
      } catch (e) {
        error = e.message;
      } finally {
        loading = false;
      }
    }
    function buildChartOptions() {
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      chartOption = buildFullChartOption({
        rpmLines,
        rpmPoints,
        efficiencyPoints,
        chartTheme,
        title: currentFan ? currentFan.model : "Fan Map",
        clipRpmAreaToPermissibleUse: true,
        showRpmBandShading: currentFan?.show_rpm_band_shading ?? true,
        showSecondaryAxis: false,
        adaptGraphBackgroundToTheme: true,
        graphStyle: currentFan ? {
          band_graph_background_color: currentFan.band_graph_background_color,
          band_graph_label_text_color: currentFan.band_graph_label_text_color,
          band_graph_faded_opacity: currentFan.band_graph_faded_opacity,
          band_graph_permissible_label_color: currentFan.band_graph_permissible_label_color
        } : null
      });
    }
    loadFans();
    if (selectedFanId) {
      loadMap();
    }
    if (store_get($$store_subs ??= {}, "$theme", theme)) {
      buildChartOptions();
    }
    head("w85nl5", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Fan map — Fan Graphs</title>`);
      });
    });
    $$renderer2.push(`<div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Single Fan View</p> <h1 class="h2 mb-2">Fan map</h1> <p class="text-body-secondary">Review one fan’s airflow vs pressure map with RPM bands and efficiency or permissible overlays.</p></div></div> <div class="row g-3"><div class="col-12 col-xl-3"><div class="vstack gap-3"><div class="card shadow-sm p-3"><h2 class="h5">Select fan</h2> <label class="form-label" for="map-fan-select">Fan record</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "map-fan-select",
        value: selectedFanId,
        disabled: loading
      },
      ($$renderer3) => {
        $$renderer3.option({ value: null }, ($$renderer4) => {
          $$renderer4.push(`— Select —`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(fans);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let fan = each_array[$$index];
          $$renderer3.option({ value: fan.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(fan.model)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm p-3"><p class="text-danger mb-0">${escape_html(error)}</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="card shadow-sm p-3"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Reading Guide</p> <p class="text-body-secondary mb-0">RPM levels are shown as shaded bands. Efficiency centre appears in green,
        efficiency lower and higher end in red, and permissible use in grey.</p></div></div></div> <div class="col-12 col-xl-9"><div class="vstack gap-3">`);
    if (selectedFanId) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm p-3"><h2 class="h5">Airflow vs pressure (RPM bands)</h2> <div class="mt-3">`);
      ECharts($$renderer2, { option: chartOption, height: "750px" });
      $$renderer2.push(`<!----></div></div> `);
      if (selectedFanId && rpmPoints.length === 0 && efficiencyPoints.length === 0 && !loading) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="card shadow-sm p-3"><p class="text-body-secondary mb-0">No map points for this fan. Add map points on the Data entry page.</p></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
