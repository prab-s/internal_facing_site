import * as universal from '../entries/pages/products/_page.js';

export const index = 24;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/products/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/products/+page.js";
export const imports = ["_app/immutable/nodes/24.xW7ClNeQ.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/VXGOBXpK.js","_app/immutable/chunks/CbLfuIIL.js","_app/immutable/chunks/5tdYLWLh.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/C3tAR3YK.js","_app/immutable/chunks/D6MckSpg.js","_app/immutable/chunks/BNKzlH8n.js","_app/immutable/chunks/CVDUDb2U.js","_app/immutable/chunks/xuM6XkN1.js","_app/immutable/chunks/BWABBEwM.js"];
export const stylesheets = ["_app/immutable/assets/24.Ba9XkRvu.css"];
export const fonts = [];
