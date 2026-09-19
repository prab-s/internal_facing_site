import * as universal from '../entries/pages/products/_page.js';

export const index = 24;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/products/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/products/+page.js";
export const imports = ["_app/immutable/nodes/24.A9UxH05x.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CtdFRN5m.js","_app/immutable/chunks/Cm-Ynkdt.js","_app/immutable/chunks/D0DoUd5q.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/MvrDn6In.js","_app/immutable/chunks/DNC142FY.js","_app/immutable/chunks/C4-2qumi.js","_app/immutable/chunks/C3v-9UZX.js","_app/immutable/chunks/aI_kD3oq.js","_app/immutable/chunks/CL6OjGOU.js"];
export const stylesheets = ["_app/immutable/assets/24.Ba9XkRvu.css"];
export const fonts = [];
