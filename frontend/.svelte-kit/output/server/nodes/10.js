import * as universal from '../entries/pages/editor/series/_page.js';

export const index = 10;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/editor/series/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/editor/series/+page.js";
export const imports = ["_app/immutable/nodes/10.Bn0tQOtB.js","_app/immutable/chunks/hp4PFHFv.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/DKRHKfi9.js","_app/immutable/chunks/BGcEhvyS.js","_app/immutable/chunks/CrZlowxa.js","_app/immutable/chunks/CXpGj7Fj.js","_app/immutable/chunks/Bo2xSiCg.js","_app/immutable/chunks/1QJKc3-Y.js","_app/immutable/chunks/BL7PJqyh.js","_app/immutable/chunks/BbTwwaBR.js"];
export const stylesheets = [];
export const fonts = [];
