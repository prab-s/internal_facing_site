import * as universal from '../entries/pages/editor/series/_page.js';

export const index = 10;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/editor/series/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/editor/series/+page.js";
export const imports = ["_app/immutable/nodes/10.DgVwmAvb.js","_app/immutable/chunks/hp4PFHFv.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/Jt1JAgwm.js","_app/immutable/chunks/C8xm4LVl.js","_app/immutable/chunks/BhgSD-pV.js","_app/immutable/chunks/B0XTUDau.js","_app/immutable/chunks/CSuBh2CB.js","_app/immutable/chunks/BUmB39ht.js","_app/immutable/chunks/Ey9Bomub.js","_app/immutable/chunks/DHjHtVx6.js","_app/immutable/chunks/D9zlKHzW.js"];
export const stylesheets = [];
export const fonts = [];
