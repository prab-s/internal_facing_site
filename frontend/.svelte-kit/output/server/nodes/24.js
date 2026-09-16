import * as universal from '../entries/pages/products/_page.js';

export const index = 24;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/products/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/products/+page.js";
export const imports = ["_app/immutable/nodes/24.C_xZCWwd.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/zp7u3Sa_.js","_app/immutable/chunks/DdtvNF3y.js","_app/immutable/chunks/BKYmgqdq.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/ClWZ2-xE.js","_app/immutable/chunks/BUn2MEvG.js","_app/immutable/chunks/D8PeEaBm.js","_app/immutable/chunks/BUUE4hRg.js","_app/immutable/chunks/ByGvsqqv.js","_app/immutable/chunks/kVI2SJ5G.js"];
export const stylesheets = ["_app/immutable/assets/24.Ba9XkRvu.css"];
export const fonts = [];
