import { w as writable } from "./index.js";
const API_BASE = "/api";
const GLOBAL_UNIT_OPTIONS = [
  "A",
  "Hz",
  "kg",
  "kW",
  "L/s",
  "m3/h",
  "mm",
  "Pa",
  "RPM",
  "V",
  "°C"
];
function emptyProductForm() {
  return {
    model: "",
    product_type_key: "fan",
    series_id: null,
    series_name: "",
    printed_template_id: "",
    online_template_id: "",
    description1_html: "",
    description2_html: "",
    description3_html: "",
    comments_html: "",
    show_rpm_band_shading: true,
    band_graph_background_color: "#ffffff",
    band_graph_label_text_color: "#000000"
  };
}
const theme = writable("light");
export {
  API_BASE as A,
  GLOBAL_UNIT_OPTIONS as G,
  emptyProductForm as e,
  theme as t
};
