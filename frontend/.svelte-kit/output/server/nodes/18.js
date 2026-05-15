import * as universal from '../entries/pages/viewer/_page.js';

export const index = 18;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/viewer/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/viewer/+page.js";
export const imports = ["_app/immutable/nodes/18.D8mIwGy2.js","_app/immutable/chunks/ft-thZGf.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/CwKU-PYF.js","_app/immutable/chunks/C6CJiL_4.js","_app/immutable/chunks/DuarYxfY.js","_app/immutable/chunks/Ba1gQDHY.js","_app/immutable/chunks/BK6j85qX.js","_app/immutable/chunks/D3eFy9m5.js","_app/immutable/chunks/Df4-lkXd.js","_app/immutable/chunks/Cj7Sq08b.js","_app/immutable/chunks/C21D1Dki.js","_app/immutable/chunks/Bfc47y5P.js","_app/immutable/chunks/DK9B0loH.js","_app/immutable/chunks/DR1oJ4wt.js","_app/immutable/chunks/DjKyzJ-J.js","_app/immutable/chunks/BiVeJLU6.js","_app/immutable/chunks/Bjzy9LBM.js","_app/immutable/chunks/kHU_6eWs.js","_app/immutable/chunks/BNqf1zIy.js"];
export const stylesheets = ["_app/immutable/assets/18.j6psIWKi.css"];
export const fonts = [];
