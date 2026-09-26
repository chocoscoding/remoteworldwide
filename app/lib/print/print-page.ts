// The parts the two print pages share: the page shell's CSS, and the inline
// scripts that tell the renderer when the page is ready to print.
//
// The pages sit under the root layout like every other route (the Tailwind
// build and the next/font faces come from there), so the layout's other
// children — the toast container, the top loader, the downtime banner — are in
// the document too. `PRINT_SHELL_CSS` hides everything in <body> but the print
// root, which is a direct child of <body> because the layout's providers render
// no elements of their own.
//
// The readiness protocol is the AI renderer's (see its contract): it loads the
// page, waits for `window.__rwwPrint.ready`, and prints with the page's own
// `@page` size. `__rwwPrint.error` fails the render on purpose. The script:
//
//   1. waits for `load`, then lays the page out so the faces in use start
//      loading, then waits for `document.fonts.ready` (at most 8s — past that
//      the fallback face prints, which is a worse PDF but not none);
//   2. for a resume, measures the paper: its `min-height` is one page, so a
//      taller paper runs to more than one, and the multi-page rules apply;
//   3. injects the print CSS (`@page` and all, from print-css.ts, the same
//      strings the browser export uses) into <head>, adds the multi-page class,
//      and sets `ready`.
//
// Why the CSS goes into <head> and the class onto the root after the fact,
// rather than being rendered: whether the resume is one page or two is only
// known once the fonts have laid it out. React 19 hydration skips unexpected
// nodes in <head>, and leaves an attribute it did not render alone, so neither
// change is undone by hydration.

import { printFrameCss } from "@/app/lib/export/print-css";

export const PRINT_ROOT_ATTRIBUTE = "data-rww-print-root";

/** On screen and in print: only the print root, on a white page with no body margin. */
export const PRINT_SHELL_CSS = `body>:not([${PRINT_ROOT_ATTRIBUTE}]){display:none!important;}html,body{margin:0;padding:0;background:#fff;min-height:0;}`;

/** Runs first: the renderer polls for this object and must find `ready: false` until the end. */
export const PRINT_BOOT_SCRIPT = "window.__rwwPrint={ready:false};";

export interface PrintVariant {
  /** Everything printed: `printFrameCss(...)` plus the document's own print rules. */
  css: string;
  /** Classes added to the print root when this variant is chosen. */
  addClass: string;
}

export interface PrintReadyConfig {
  /** Measure the paper (the root's first child) against one page's height. Resumes only. */
  measure: boolean;
  single: PrintVariant;
  /** Used when `measure` finds more than one page. */
  multi?: PrintVariant;
}

/** JSON that is safe inside a <script>: no `</script>` and no `<!--`. (U+2028/9 are legal in string literals since ES2019.) */
const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c");

export function printReadyScript(config: PrintReadyConfig): string {
  return `(function(){
var P=window.__rwwPrint||(window.__rwwPrint={ready:false});
var C=${scriptJson(config)};
var root=function(){return document.querySelector("[${PRINT_ROOT_ATTRIBUTE}]");};
function finish(){try{
var r=root();if(!r){P.error="no_print_root";return;}
var pages=1;
if(C.measure){var paper=r.firstElementChild;if(!paper){P.error="no_paper";return;}
var pageH=parseFloat(getComputedStyle(paper).minHeight)||0;
if(pageH>0)pages=Math.max(1,Math.ceil((paper.offsetHeight-1)/pageH));}
var v=pages>1&&C.multi?C.multi:C.single;
if(v.addClass)v.addClass.split(" ").forEach(function(c){if(c)r.classList.add(c);});
var s=document.createElement("style");s.setAttribute("data-rww-print","");s.textContent=v.css;document.head.appendChild(s);
P.pages=pages;P.multi=pages>1;P.ready=true;
}catch(e){P.error="print_script";}}
function afterLoad(){
var r=root();if(r)void r.offsetHeight;
var waited=new Promise(function(done){setTimeout(function(){if(!P.ready)P.fonts="timeout";done();},8000);});
Promise.race([document.fonts.ready,waited]).then(function(){setTimeout(finish,50);});
}
if(document.readyState==="complete")afterLoad();else window.addEventListener("load",afterLoad,{once:true});
})();`;
}

/** A variant from a page size, a margin and the document's own rules. */
export const printVariant = (pageSize: string, pageMargin: string, css: string, addClass = ""): PrintVariant => ({
  css: printFrameCss(pageSize, pageMargin) + css,
  addClass,
});
