import { c as create_ssr_component, o as onDestroy, e as escape, d as add_attribute } from "./ssr.js";
import "echarts";
const ECharts = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { option = {} } = $$props;
  let { height = "400px" } = $$props;
  let { on = {} } = $$props;
  let { onChartReady = null } = $$props;
  let container;
  onDestroy(() => {
    window.removeEventListener("resize", resize);
  });
  function resize() {
  }
  if ($$props.option === void 0 && $$bindings.option && option !== void 0) $$bindings.option(option);
  if ($$props.height === void 0 && $$bindings.height && height !== void 0) $$bindings.height(height);
  if ($$props.on === void 0 && $$bindings.on && on !== void 0) $$bindings.on(on);
  if ($$props.onChartReady === void 0 && $$bindings.onChartReady && onChartReady !== void 0) $$bindings.onChartReady(onChartReady);
  return `<div class="chart-container" style="${"height: " + escape(height, true) + "; border: 1px solid red; background: white;"}"${add_attribute("this", container, 0)}></div>`;
});
export {
  ECharts as E
};
