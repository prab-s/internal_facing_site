import { a9 as fallback, aa as attr_style, ab as bind_props, ac as stringify } from "./index2.js";
import { o as onDestroy } from "./index-server.js";
import "echarts";
function ECharts($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let option = fallback($$props["option"], () => ({}), true);
    let height = fallback($$props["height"], "400px");
    let on = fallback($$props["on"], () => ({}), true);
    let onChartReady = fallback(
      $$props["onChartReady"],
      null
      // (chart) => void
    );
    onDestroy(() => {
      window.removeEventListener("resize", resize);
    });
    function resize() {
    }
    $$renderer2.push(`<div class="chart-container echart-host"${attr_style(`height: ${stringify(height)};`)}></div>`);
    bind_props($$props, { option, height, on, onChartReady });
  });
}
export {
  ECharts as E
};
