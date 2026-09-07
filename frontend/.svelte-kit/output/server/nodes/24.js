import * as universal from '../entries/pages/products/_page.js';

export const index = 24;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/products/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/products/+page.js";
export const imports = ["_app/immutable/nodes/24.Bo9RtR2Z.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/BNU4c8Ja.js","_app/immutable/chunks/CswXccuY.js","_app/immutable/chunks/BxZVdMgG.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/Xfvm0wh3.js","_app/immutable/chunks/B3YFOBiC.js","_app/immutable/chunks/DbgJIGMH.js","_app/immutable/chunks/3otpX3pZ.js","_app/immutable/chunks/B0JxcrLz.js","_app/immutable/chunks/CjQCcfaa.js","_app/immutable/chunks/CLF68cq-.js"];
export const stylesheets = ["_app/immutable/assets/24.Ba9XkRvu.css"];
export const fonts = [];
