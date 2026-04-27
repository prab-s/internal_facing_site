import * as universal from '../entries/pages/editor/series/_page.js';

export const index = 10;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/editor/series/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/editor/series/+page.js";
export const imports = ["_app/immutable/nodes/10.CCggVNRO.js","_app/immutable/chunks/hp4PFHFv.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/Dl4k7A-v.js","_app/immutable/chunks/D6I27d9g.js","_app/immutable/chunks/Cdx2qfIJ.js","_app/immutable/chunks/CQtYVt19.js","_app/immutable/chunks/DZFTWhPy.js","_app/immutable/chunks/8Tzl_PT2.js","_app/immutable/chunks/DJH0wV0E.js","_app/immutable/chunks/DDEAEVKg.js"];
export const stylesheets = [];
export const fonts = [];
