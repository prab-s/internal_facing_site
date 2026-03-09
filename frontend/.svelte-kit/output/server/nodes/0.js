

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.BFAZxkjg.js","_app/immutable/chunks/COLML_Uy.js","_app/immutable/chunks/Dzuv9Zi9.js"];
export const stylesheets = ["_app/immutable/assets/0.C-kaOPIR.css"];
export const fonts = [];
