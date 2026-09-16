import * as universal from '../entries/pages/products/_product_/_page.js';

export const index = 25;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/products/_product_/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/products/[product]/+page.js";
export const imports = ["_app/immutable/nodes/25.Bsw7dLfO.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CTtufLnT.js","_app/immutable/chunks/DdtvNF3y.js","_app/immutable/chunks/BKYmgqdq.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/ClWZ2-xE.js","_app/immutable/chunks/BUn2MEvG.js","_app/immutable/chunks/CuXvYvRI.js","_app/immutable/chunks/D8PeEaBm.js","_app/immutable/chunks/BUUE4hRg.js","_app/immutable/chunks/ByGvsqqv.js","_app/immutable/chunks/kVI2SJ5G.js","_app/immutable/chunks/BLrqHRT2.js","_app/immutable/chunks/C1FmrZbK.js","_app/immutable/chunks/DBh9dkB8.js","_app/immutable/chunks/BJpVP7VU.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/CK4h5DM7.js","_app/immutable/chunks/BfQNT8IA.js"];
export const stylesheets = ["_app/immutable/assets/25.ByKUvYLX.css"];
export const fonts = [];
