import * as universal from '../entries/pages/cms/_page.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/cms/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/cms/+page.js";
export const imports = ["_app/immutable/nodes/6.DI9NSAy5.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/Xfvm0wh3.js","_app/immutable/chunks/CswXccuY.js","_app/immutable/chunks/CZhBM-_2.js","_app/immutable/chunks/BxZVdMgG.js","_app/immutable/chunks/B3YFOBiC.js","_app/immutable/chunks/BNU4c8Ja.js","_app/immutable/chunks/DbgJIGMH.js","_app/immutable/chunks/3otpX3pZ.js","_app/immutable/chunks/RXFdabFz.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/CjSuLwnf.js","_app/immutable/chunks/BxoftTQQ.js","_app/immutable/chunks/B0JxcrLz.js"];
export const stylesheets = ["_app/immutable/assets/6.CPZxJlhW.css"];
export const fonts = [];
