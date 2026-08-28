/* globals.d.ts — what the classic scripts put on `window`, declared so a typechecker can see it.
 *
 * NOT A STEP TOWARDS TYPESCRIPT. Ipsissima's renderer is a classic script with no build step,
 * because the product is ONE self-contained HTML file and the renderer is inlined into it: a
 * module graph would mean a bundler between the source and the thing people double-click. That
 * design has a cost — the pieces find each other through globals — and this file is what lets a
 * typechecker read those globals rather than reporting each one as an unknown name.
 *
 * Everything here is a shape the code already relies on. Nothing is aspirational.
 */

declare function require(id: string): any;
declare const module: { exports: any } | undefined;

interface Window {
  /** The bundled Argdown parser, present in a `--standalone` build. */
  __ARGDOWN_PARSE__?: (text: string) => any;
  /** The annotated-export bundle, loaded on demand. */
  __EXPORT__?: any;
  __DOCX__?: any;
  /** Front-matter and metadata validation, shared with the editor. */
  __ARGDOWN_METADATA_CHECK__?: (text: string) => any[];
  showDirectoryPicker?: (opts?: any) => Promise<any>;
  showSaveFilePicker?: (opts?: any) => Promise<any>;
  /** The Tauri shell, when the page is running inside the desktop app. */
  __TAURI__?: any;
  ArgdownHost?: any;
  ArgdownLiveMap?: any;
  ArgdownPositions?: any;
  ArgdownExposition?: any;
  ArgdownBundle?: any;
  /** The section list a page is assembled from, shared with the builder. */
  ArgdownPage?: any;
  /** Vendored layout engine, loaded before the renderer. */
  dagre?: any;
}

declare var ArgdownLiveMap: any;
declare var ArgdownPositions: any;
declare var ArgdownExposition: any;
declare var ArgdownBundle: any;
declare var ArgdownPage: any;
declare var ArgdownHost: any;
declare var dagre: any;
