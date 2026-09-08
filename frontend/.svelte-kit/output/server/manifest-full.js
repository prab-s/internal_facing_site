export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.ico","favicon.png"]),
	mimeTypes: {".png":"image/png"},
	_: {
		client: {start:"_app/immutable/entry/start.CuXnGjCM.js",app:"_app/immutable/entry/app.pdkg0C3n.js",imports:["_app/immutable/entry/start.CuXnGjCM.js","_app/immutable/chunks/BLqUbnE1.js","_app/immutable/chunks/DBh9dkB8.js","_app/immutable/chunks/DdtvNF3y.js","_app/immutable/chunks/BKYmgqdq.js","_app/immutable/chunks/BUApaBEI.js","_app/immutable/entry/app.pdkg0C3n.js","_app/immutable/chunks/C1FmrZbK.js","_app/immutable/chunks/DdtvNF3y.js","_app/immutable/chunks/BKYmgqdq.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/DBh9dkB8.js","_app/immutable/chunks/BUn2MEvG.js","_app/immutable/chunks/CK4h5DM7.js","_app/immutable/chunks/kVI2SJ5G.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js')),
			__memo(() => import('./nodes/19.js')),
			__memo(() => import('./nodes/20.js')),
			__memo(() => import('./nodes/21.js')),
			__memo(() => import('./nodes/22.js')),
			__memo(() => import('./nodes/23.js')),
			__memo(() => import('./nodes/24.js')),
			__memo(() => import('./nodes/25.js')),
			__memo(() => import('./nodes/26.js')),
			__memo(() => import('./nodes/27.js')),
			__memo(() => import('./nodes/28.js')),
			__memo(() => import('./nodes/29.js')),
			__memo(() => import('./nodes/30.js')),
			__memo(() => import('./nodes/31.js')),
			__memo(() => import('./nodes/32.js')),
			__memo(() => import('./nodes/33.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/bulk-actions",
				pattern: /^\/bulk-actions\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/bulk-import",
				pattern: /^\/bulk-import\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/catalogue",
				pattern: /^\/catalogue\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/cms-experimental",
				pattern: /^\/cms-experimental\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/cms",
				pattern: /^\/cms\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/editor",
				pattern: /^\/editor\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/editor/create",
				pattern: /^\/editor\/create\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/editor/edit",
				pattern: /^\/editor\/edit\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/editor/edit/[product]",
				pattern: /^\/editor\/edit\/([^/]+?)\/?$/,
				params: [{"name":"product","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/editor/product-types",
				pattern: /^\/editor\/product-types\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/editor/product-types/create",
				pattern: /^\/editor\/product-types\/create\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/editor/product-types/edit",
				pattern: /^\/editor\/product-types\/edit\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/editor/product-types/edit/[product_type]",
				pattern: /^\/editor\/product-types\/edit\/([^/]+?)\/?$/,
				params: [{"name":"product_type","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/editor/quote-requests",
				pattern: /^\/editor\/quote-requests\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/editor/series",
				pattern: /^\/editor\/series\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/editor/series/create",
				pattern: /^\/editor\/series\/create\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/editor/series/edit",
				pattern: /^\/editor\/series\/edit\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/editor/series/edit/[series]",
				pattern: /^\/editor\/series\/edit\/([^/]+?)\/?$/,
				params: [{"name":"series","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 20 },
				endpoint: null
			},
			{
				id: "/enquiries",
				pattern: /^\/enquiries\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 21 },
				endpoint: null
			},
			{
				id: "/entry",
				pattern: /^\/entry\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 22 },
				endpoint: null
			},
			{
				id: "/map",
				pattern: /^\/map\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 23 },
				endpoint: null
			},
			{
				id: "/products",
				pattern: /^\/products\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 24 },
				endpoint: null
			},
			{
				id: "/products/type/[product_type]",
				pattern: /^\/products\/type\/([^/]+?)\/?$/,
				params: [{"name":"product_type","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 26 },
				endpoint: null
			},
			{
				id: "/products/[product]",
				pattern: /^\/products\/([^/]+?)\/?$/,
				params: [{"name":"product","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 25 },
				endpoint: null
			},
			{
				id: "/quotes",
				pattern: /^\/quotes\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 27 },
				endpoint: null
			},
			{
				id: "/series/[series]",
				pattern: /^\/series\/([^/]+?)\/?$/,
				params: [{"name":"series","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 28 },
				endpoint: null
			},
			{
				id: "/setup",
				pattern: /^\/setup\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 29 },
				endpoint: null
			},
			{
				id: "/template-builder-v2",
				pattern: /^\/template-builder-v2\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 31 },
				endpoint: null
			},
			{
				id: "/template-builder",
				pattern: /^\/template-builder\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 30 },
				endpoint: null
			},
			{
				id: "/viewer",
				pattern: /^\/viewer\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 32 },
				endpoint: null
			},
			{
				id: "/viewer/[tab]/[[record]]",
				pattern: /^\/viewer\/([^/]+?)(?:\/([^/]+))?\/?$/,
				params: [{"name":"tab","optional":false,"rest":false,"chained":false},{"name":"record","optional":true,"rest":false,"chained":true}],
				page: { layouts: [0,], errors: [1,], leaf: 33 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
