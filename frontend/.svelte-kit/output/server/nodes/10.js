import * as universal from '../entries/pages/editor/edit/_page.js';

export const index = 10;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/editor/edit/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/editor/edit/+page.js";
export const imports = ["_app/immutable/nodes/10.BPNSe3Ru.js","_app/immutable/chunks/pfMRWl6z.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/ClWZ2-xE.js","_app/immutable/chunks/DdtvNF3y.js","_app/immutable/chunks/D8PeEaBm.js","_app/immutable/chunks/ByGvsqqv.js","_app/immutable/chunks/kVI2SJ5G.js","_app/immutable/chunks/BUn2MEvG.js","_app/immutable/chunks/BKYmgqdq.js","_app/immutable/chunks/C4qjktsY.js","_app/immutable/chunks/CZYNdxxj.js","_app/immutable/chunks/BUUE4hRg.js","_app/immutable/chunks/CV2szYgr.js","_app/immutable/chunks/DBh9dkB8.js","_app/immutable/chunks/Ba1s20U4.js","_app/immutable/chunks/CTtufLnT.js","_app/immutable/chunks/DbzGJINe.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/BJpVP7VU.js","_app/immutable/chunks/amervIF4.js","_app/immutable/chunks/BzMOISJT.js","_app/immutable/chunks/CK4h5DM7.js","_app/immutable/chunks/BEjNGd9v.js","_app/immutable/chunks/BLrqHRT2.js","_app/immutable/chunks/C1FmrZbK.js","_app/immutable/chunks/ONYtivJx.js","_app/immutable/chunks/Bk_60T4Y.js","_app/immutable/chunks/CNfvMq-A.js","_app/immutable/chunks/Bfc47y5P.js","_app/immutable/chunks/JRBDVWwy.js","_app/immutable/chunks/BfQNT8IA.js","_app/immutable/chunks/2ISBZP8m.js"];
export const stylesheets = ["_app/immutable/assets/RichTextEditor.WXTMFd2b.css","_app/immutable/assets/ProductWorkspace.P_PrZZaa.css"];
export const fonts = [];
