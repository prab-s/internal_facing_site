import * as universal from '../entries/pages/quotes/_page.js';

export const index = 27;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/quotes/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/quotes/+page.js";
export const imports = ["_app/immutable/nodes/27.CjI_vwkU.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/ClWZ2-xE.js","_app/immutable/chunks/DdtvNF3y.js","_app/immutable/chunks/D8PeEaBm.js"];
export const stylesheets = [];
export const fonts = [];
