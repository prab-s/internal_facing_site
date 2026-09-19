import * as universal from '../entries/pages/products/_product_/_page.js';

export const index = 25;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/products/_product_/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/products/[product]/+page.js";
export const imports = ["_app/immutable/nodes/25.eH-N4lG-.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/VXGOBXpK.js","_app/immutable/chunks/CbLfuIIL.js","_app/immutable/chunks/5tdYLWLh.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/C3tAR3YK.js","_app/immutable/chunks/D6MckSpg.js","_app/immutable/chunks/CG1Lu8VG.js","_app/immutable/chunks/BNKzlH8n.js","_app/immutable/chunks/CVDUDb2U.js","_app/immutable/chunks/xuM6XkN1.js","_app/immutable/chunks/BWABBEwM.js","_app/immutable/chunks/VbgfF2Bn.js","_app/immutable/chunks/C1FmrZbK.js","_app/immutable/chunks/DxFNoUPn.js","_app/immutable/chunks/B5Ba5hU3.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/DAN2sdwG.js","_app/immutable/chunks/BfQNT8IA.js"];
export const stylesheets = ["_app/immutable/assets/25.ByKUvYLX.css"];
export const fonts = [];
