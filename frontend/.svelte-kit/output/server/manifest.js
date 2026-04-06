export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["bg.jpg"]),
	mimeTypes: {".jpg":"image/jpeg"},
	_: {
		client: {start:"_app/immutable/entry/start.Yc4MCdMd.js",app:"_app/immutable/entry/app.BUmDlwEt.js",imports:["_app/immutable/entry/start.Yc4MCdMd.js","_app/immutable/chunks/a4Pgsa59.js","_app/immutable/chunks/tvvodZvZ.js","_app/immutable/entry/app.BUmDlwEt.js","_app/immutable/chunks/tvvodZvZ.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/BLghSlww.js","_app/immutable/chunks/D9SDZjD7.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js'))
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
				id: "/catalogue",
				pattern: /^\/catalogue\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/entry",
				pattern: /^\/entry\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/map",
				pattern: /^\/map\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/setup",
				pattern: /^\/setup\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
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
