import * as universal from '../entries/pages/editor/series/_page.js';

export const index = 10;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/editor/series/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/editor/series/+page.js";
export const imports = ["_app/immutable/nodes/10.BPZcY621.js","_app/immutable/chunks/hp4PFHFv.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/CwKU-PYF.js","_app/immutable/chunks/C6CJiL_4.js","_app/immutable/chunks/D3eFy9m5.js","_app/immutable/chunks/cNkFxo2C.js","_app/immutable/chunks/Ba1gQDHY.js","_app/immutable/chunks/DfTX25vL.js","_app/immutable/chunks/Df4-lkXd.js","_app/immutable/chunks/DR1oJ4wt.js"];
export const stylesheets = [];
export const fonts = [];
