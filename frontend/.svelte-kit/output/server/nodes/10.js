import * as universal from '../entries/pages/editor/series/_page.js';

export const index = 10;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/editor/series/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/editor/series/+page.js";
export const imports = ["_app/immutable/nodes/10.CnPG9ew0.js","_app/immutable/chunks/hp4PFHFv.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/BYZ-EFkE.js","_app/immutable/chunks/rcSsnogX.js","_app/immutable/chunks/C9MLpR59.js","_app/immutable/chunks/CSwgT3wP.js","_app/immutable/chunks/GpOppX6x.js","_app/immutable/chunks/D03ckb-5.js","_app/immutable/chunks/DLfggFT_.js","_app/immutable/chunks/BWD8c4EO.js"];
export const stylesheets = [];
export const fonts = [];
