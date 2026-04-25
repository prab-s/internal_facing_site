
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/catalogue" | "/editor" | "/editor/create" | "/editor/edit" | "/editor/product-types" | "/editor/product-types/create" | "/editor/product-types/edit" | "/editor/product" | "/editor/product/create" | "/editor/product/edit" | "/editor/series" | "/editor/series/create" | "/editor/series/edit" | "/entry" | "/map" | "/setup" | "/template-builder" | "/viewer";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/catalogue": Record<string, never>;
			"/editor": Record<string, never>;
			"/editor/create": Record<string, never>;
			"/editor/edit": Record<string, never>;
			"/editor/product-types": Record<string, never>;
			"/editor/product-types/create": Record<string, never>;
			"/editor/product-types/edit": Record<string, never>;
			"/editor/product": Record<string, never>;
			"/editor/product/create": Record<string, never>;
			"/editor/product/edit": Record<string, never>;
			"/editor/series": Record<string, never>;
			"/editor/series/create": Record<string, never>;
			"/editor/series/edit": Record<string, never>;
			"/entry": Record<string, never>;
			"/map": Record<string, never>;
			"/setup": Record<string, never>;
			"/template-builder": Record<string, never>;
			"/viewer": Record<string, never>
		};
		Pathname(): "/" | "/catalogue" | "/editor" | "/editor/create" | "/editor/edit" | "/editor/product-types" | "/editor/product-types/create" | "/editor/product-types/edit" | "/editor/series" | "/editor/series/create" | "/editor/series/edit" | "/entry" | "/map" | "/setup" | "/template-builder" | "/viewer";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/bg.jpg" | string & {};
	}
}