// The script the content canvas puts into the rendered mail before showing it in a sandboxed iframe
// (srcdoc, sandbox="allow-scripts", no same-origin: the mail runs in an opaque origin and can
// only talk to the editor through postMessage).
//
// Messages, frame to editor:   { type: "rww-size", height, marked }   after load and on resize
//                              { type: "rww-block", index }           a click on a block (null: outside any block)
//                              { type: "rww-at", top, bottom }        where the selected block sits, when asked to scroll
// Editor to frame:             { type: "rww-select", index, scroll }  outline that block (null: none)
//
// Blocks are the elements the renderer marked with data-rww-block="<index in content.blocks>"
// (previewMail with markBlocks). A paragraph block may mark several elements with one index; all
// of them light up. Without marks (an older renderer) the frame only reports its size and keeps
// links from navigating.

const SCRIPT = String.raw`(function () {
  var interactive = __INTERACTIVE__;
  var ATTR = "data-rww-block";
  var hover = null, selected = null;
  var css = document.createElement("style");
  css.textContent =
    "[" + ATTR + "]{cursor:pointer;outline:2px solid transparent;outline-offset:4px;border-radius:3px;transition:outline-color 80ms ease-out}" +
    "[" + ATTR + "].rww-hover{outline:1px dashed #6b7280}" +
    "[" + ATTR + "].rww-on{outline:2px solid #222325}" +
    "a{cursor:" + (interactive ? "pointer" : "default") + "}";
  (document.head || document.documentElement).appendChild(css);

  function send(message) { try { parent.postMessage(message, "*"); } catch (e) {} }
  function blockOf(node) {
    while (node && node.nodeType === 1) {
      if (node.hasAttribute(ATTR)) return node;
      node = node.parentElement;
    }
    return null;
  }
  function each(index, fn) {
    if (index === null) return;
    var list = document.querySelectorAll("[" + ATTR + '="' + index + '"]');
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }
  function marked() { return document.querySelectorAll("[" + ATTR + "]").length; }
  function size() {
    var body = document.body;
    var height = body ? Math.max(body.scrollHeight, body.offsetHeight) : document.documentElement.scrollHeight;
    send({ type: "rww-size", height: Math.ceil(height), marked: marked() });
  }

  document.addEventListener("click", function (event) {
    // Links never navigate inside the editor.
    event.preventDefault();
    if (!interactive || !marked()) return;
    var block = blockOf(event.target);
    send({ type: "rww-block", index: block ? Number(block.getAttribute(ATTR)) : null });
  }, true);

  if (interactive) {
    document.addEventListener("mouseover", function (event) {
      var block = blockOf(event.target);
      var index = block ? block.getAttribute(ATTR) : null;
      if (index === hover) return;
      each(hover, function (el) { el.classList.remove("rww-hover"); });
      hover = index;
      each(hover, function (el) { el.classList.add("rww-hover"); });
    });
    document.documentElement.addEventListener("mouseleave", function () {
      each(hover, function (el) { el.classList.remove("rww-hover"); });
      hover = null;
    });
  }

  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.type !== "rww-select") return;
    each(selected, function (el) { el.classList.remove("rww-on"); });
    selected = typeof data.index === "number" ? String(data.index) : null;
    var top = Infinity, bottom = -Infinity;
    each(selected, function (el) {
      el.classList.add("rww-on");
      var r = el.getBoundingClientRect();
      if (r.height > 0) { top = Math.min(top, r.top + window.scrollY); bottom = Math.max(bottom, r.bottom + window.scrollY); }
    });
    if (data.scroll && top !== Infinity) send({ type: "rww-at", top: top, bottom: bottom });
  });

  window.addEventListener("load", size);
  if (window.ResizeObserver && document.body) new ResizeObserver(size).observe(document.body);
  size();
})();`;

/** The rendered mail with the canvas script added just before </body> (or at the end). */
export function withFrameScript(html: string, interactive: boolean): string {
  const tag = `<script>${SCRIPT.replace("__INTERACTIVE__", interactive ? "true" : "false")}</script>`;
  const at = html.toLowerCase().lastIndexOf("</body>");
  return at === -1 ? `${html}${tag}` : `${html.slice(0, at)}${tag}${html.slice(at)}`;
}
