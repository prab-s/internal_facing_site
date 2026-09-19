import * as universal from '../entries/pages/products/_product_/_page.js';

export const index = 25;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/products/_product_/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/products/[product]/+page.js";
export const imports = ["_app/immutable/nodes/25.CR4AgSJ2.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CtdFRN5m.js","_app/immutable/chunks/Cm-Ynkdt.js","_app/immutable/chunks/D0DoUd5q.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/MvrDn6In.js","_app/immutable/chunks/DNC142FY.js","_app/immutable/chunks/C-YTh8Nc.js","_app/immutable/chunks/C4-2qumi.js","_app/immutable/chunks/C3v-9UZX.js","_app/immutable/chunks/aI_kD3oq.js","_app/immutable/chunks/CL6OjGOU.js","_app/immutable/chunks/BDw38Foo.js","_app/immutable/chunks/C1FmrZbK.js","_app/immutable/chunks/CuyJYtEm.js","_app/immutable/chunks/BQD35Vhi.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/BU3cTC9Z.js","_app/immutable/chunks/BfQNT8IA.js"];
export const stylesheets = ["_app/immutable/assets/25.ByKUvYLX.css"];
export const fonts = [];
