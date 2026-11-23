// The script the content canvas puts into the rendered mail before showing it in a sandboxed iframe
// (srcdoc, sandbox="allow-scripts", no same-origin: the mail runs in an opaque origin and can
// only talk to the editor through postMessage).
//
// Messages, frame to editor:   { type: "rww-size", height, marked }       after load and on resize
//                              { type: "rww-block", index }               a click on a block (null: outside any block)
//                              { type: "rww-at", top, bottom }            where the selected block sits, when asked to scroll
//                              { type: "rww-focus", index, field }        the caret went into a field
//                              { type: "rww-blur" }                       the caret left the fields
//                              { type: "rww-edit", index, field, text }   a field was typed in: its whole text, as template text
//                              { type: "rww-var-menu" }                   "{{" was just typed: open the Variable menu
// Editor to frame:             { type: "rww-select", index, scroll }      outline that block (null: none)
//                              { type: "rww-patch", index, field, text }  redraw a field from template text (an inspector edit)
//                              { type: "rww-insert-var", name }           put a variable token at the caret ("firstName|there")
//
// Blocks are the elements the renderer marked with data-rww-block="<index in content.blocks>"
// (previewMail with markBlocks, the "editor render"). A paragraph block may mark several elements
// with one index; all of them light up. In the editor render the text the admin can type into
// carries data-rww-field="<field>" and shows the raw template text, each {{name|fallback}} drawn
// as an uneditable token <span data-rww-var="name|fallback">. In interactive mode this script makes
// those fields editable (the renderer never does) and turns what is typed back into template text:
// text as text, a token as {{name|fallback}}, and in a paragraph field (data-rww-lines="many")
// <strong> as **...**, a link as [text](address) and paragraphs as blank-line breaks; in a
// one-paragraph field that keeps line breaks (data-rww-lines="breaks": a heading, an offer line)
// Enter makes a <br>, read back as one line break. Without marks
// (an older renderer) the frame only reports its size and keeps links from navigating.
//
// TOKEN_STYLE, P_STYLE and LINK_STYLE mirror the events service's renderer (src/mail/render.ts), so a
// field redrawn here looks the same as the server's render that replaces it after.

const SCRIPT = String.raw`(function () {
  var interactive = __INTERACTIVE__;
  var ATTR = "data-rww-block", FIELD = "data-rww-field", VAR = "data-rww-var";
  var TOKEN_STYLE = "display: inline-block; margin: 0 1px; padding: 0 6px; border: 1px solid #b7cdea; border-radius: 999px; background: #eef4fc; color: #1c5aa6; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.8em; font-weight: 600; font-style: normal; line-height: 1.5; letter-spacing: 0; text-transform: none; text-decoration: none; vertical-align: baseline; white-space: nowrap; cursor: default;";
  var P_STYLE = "margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #222325;";
  var LINK_STYLE = "color: #222325; font-weight: 700; text-decoration: underline;";
  var PLACEHOLDER = { text: "Heading", paragraph: "Write the paragraph.", label: "Button text", kicker: "Small line", headline: "Headline", button: "Button text", detail: "Add a line" };
  var VAR_TEXT = /\{\{\s*([A-Za-z]+)\s*(?:\|([^{}]*))?\}\}/g;
  var LINK_TEXT = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  var hover = null, selected = null;
  var focused = null, lastField = null, lastRange = null;

  var css = document.createElement("style");
  css.textContent =
    "[" + ATTR + "]{cursor:pointer;outline:2px solid transparent;outline-offset:4px;border-radius:3px;transition:outline-color 80ms ease-out}" +
    "[" + ATTR + "].rww-hover{outline:1px dashed #6b7280}" +
    "[" + ATTR + "].rww-on{outline:2px solid #222325}" +
    "a{cursor:" + (interactive ? "pointer" : "default") + "}" +
    (interactive
      ? "[" + FIELD + "]{cursor:text;outline:none}" +
        "[" + FIELD + "]:focus{outline:1px dashed currentColor;outline-offset:3px;border-radius:2px}" +
        "[" + FIELD + "].rww-empty::before{content:attr(data-rww-ph);opacity:.45;pointer-events:none}" +
        "[" + VAR + "]{user-select:all;-webkit-user-select:all}"
      : "");
  (document.head || document.documentElement).appendChild(css);

  function send(message) { try { parent.postMessage(message, "*"); } catch (e) {} }
  function blockOf(node) {
    while (node && node.nodeType !== 1) node = node.parentNode;
    while (node && node.nodeType === 1) {
      if (node.hasAttribute(ATTR)) return node;
      node = node.parentElement;
    }
    return null;
  }
  function fieldOf(node) {
    while (node && node.nodeType !== 1) node = node.parentNode;
    while (node && node.nodeType === 1) {
      if (node.hasAttribute(FIELD)) return node;
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

  /* ------------------------------------------------------------------ fields: read back */

  function rich(el) { return el.getAttribute("data-rww-lines") === "many"; }
  // A one-paragraph field that keeps line breaks (a heading, an offer line): Enter makes a new line.
  function breaks(el) { return el.getAttribute("data-rww-lines") === "breaks"; }
  function oneBreak(text) { return text.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/\n{2,}/g, "\n").replace(/^\n+|\n+$/g, ""); }
  function where(el) {
    var block = blockOf(el);
    return block ? { index: Number(block.getAttribute(ATTR)), field: el.getAttribute(FIELD) } : null;
  }
  function isBlock(node) { return node.nodeType === 1 && !node.hasAttribute(VAR) && /^(P|DIV|LI|UL|OL|H[1-6]|BLOCKQUOTE|TABLE|TR|TD)$/.test(node.tagName); }
  // A <br> with nothing after it is the browser's placeholder in an empty line, not a line break.
  function trailing(node) {
    for (var n = node.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.replace(/​/g, "") !== "")) return false;
    }
    return true;
  }
  function nodeText(node, md) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1) return "";
    if (node.hasAttribute(VAR)) return "{{" + node.getAttribute(VAR) + "}}";
    if (node.tagName === "BR") return trailing(node) ? "" : "\n";
    var inner = childrenText(node, md);
    if (isBlock(node)) return "\n" + inner + "\n";
    if (md && (node.tagName === "STRONG" || node.tagName === "B")) return inner.trim() ? "**" + inner + "**" : inner;
    if (md && node.tagName === "A") {
      var href = node.getAttribute("data-rww-href") || node.getAttribute("href") || "";
      return inner.trim() && href ? "[" + inner + "](" + href + ")" : inner;
    }
    return inner;
  }
  function childrenText(node, md) {
    var out = "";
    for (var c = node.firstChild; c; c = c.nextSibling) out += nodeText(c, md);
    return out;
  }
  // A paragraph field: each block element (or run of loose text) is a paragraph, empty ones dropped.
  function paragraphsOf(node) {
    var parts = [], run = "";
    function flush() { if (run.replace(/[​\s]/g, "") !== "") parts.push(run); run = ""; }
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (isBlock(c)) { flush(); parts.push.apply(parts, paragraphsOf(c)); }
      else run += nodeText(c, true);
    }
    flush();
    return parts;
  }
  function clean(text) { return text.replace(/ /g, " ").replace(/​/g, ""); }
  function serialize(el) {
    if (rich(el)) return clean(paragraphsOf(el).join("\n\n"));
    if (breaks(el)) return oneBreak(clean(childrenText(el, false)));
    return clean(childrenText(el, false)).replace(/\s*\n+\s*/g, " ");
  }

  /* ------------------------------------------------------------------- fields: draw */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function tokenHtml(name, fallback) {
    return '<span ' + VAR + '="' + esc(fallback === undefined ? name : name + "|" + fallback) + '" contenteditable="false" style="' + TOKEN_STYLE + '">' + esc(name) + "</span>";
  }
  // Template text as the renderer's editor view draws it: escaped, variables as tokens; md also bold and line breaks.
  function textHtml(text, md, br) {
    var tokens = [];
    var lifted = text.replace(/[]/g, "").replace(VAR_TEXT, function (_, name, fallback) {
      tokens.push(tokenHtml(name, fallback));
      return "" + (tokens.length - 1) + "";
    });
    var out = esc(lifted);
    if (md) out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />");
    else if (br) out = out.replace(/\n/g, "<br />");
    return out.replace(/(\d+)/g, function (_, at) { return tokens[Number(at)] || ""; });
  }
  function inlineHtml(text) {
    var out = "", last = 0, m;
    LINK_TEXT.lastIndex = 0;
    while ((m = LINK_TEXT.exec(text))) {
      out += textHtml(text.slice(last, m.index), true);
      out += '<a data-rww-href="' + esc(m[2]) + '" style="' + LINK_STYLE + '">' + textHtml(m[1], true) + "</a>";
      last = m.index + m[0].length;
    }
    return out + textHtml(text.slice(last), true);
  }
  function draw(el, text) {
    if (rich(el)) {
      el.innerHTML = text.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean)
        .map(function (p) { return '<p style="' + P_STYLE + '">' + inlineHtml(p) + "</p>"; }).join("");
    } else {
      el.innerHTML = textHtml(text, false, breaks(el));
    }
    markEmpty(el);
  }
  function markEmpty(el) {
    var empty = serialize(el).trim() === "" && !el.querySelector("[" + VAR + "]");
    if (empty) el.classList.add("rww-empty"); else el.classList.remove("rww-empty");
  }

  /* -------------------------------------------------------------------- fields: type */

  function sendEdit(el) {
    var at = where(el);
    if (!at) return;
    send({ type: "rww-edit", index: at.index, field: at.field, text: serialize(el) });
  }
  function saveRange() {
    if (!focused) return;
    var sel = window.getSelection();
    if (sel && sel.rangeCount && focused.contains(sel.getRangeAt(0).commonAncestorContainer)) lastRange = sel.getRangeAt(0).cloneRange();
  }
  function before(n) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return "";
    var r = sel.getRangeAt(0);
    if (!r.collapsed || r.startContainer.nodeType !== 3) return "";
    return r.startContainer.nodeValue.slice(Math.max(0, r.startOffset - n), r.startOffset);
  }
  function insertVar(name) {
    if (typeof name !== "string" || !/^[A-Za-z]+(\|[^{}]*)?$/.test(name) || name.length > 120) return;
    var el = focused || lastField;
    if (!el || !el.isConnected) return;
    var sel = window.getSelection();
    var range = sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.getRangeAt(0).cloneRange() : null;
    if (!range && lastRange && el.contains(lastRange.commonAncestorContainer)) range = lastRange.cloneRange();
    if (!range) { range = document.createRange(); range.selectNodeContents(el); range.collapse(false); }
    if (document.activeElement !== el) el.focus();
    // The "{{" typed to open the menu becomes the token.
    if (range.collapsed && range.startContainer.nodeType === 3 && range.startOffset >= 2 &&
        range.startContainer.nodeValue.slice(range.startOffset - 2, range.startOffset) === "{{") {
      range.setStart(range.startContainer, range.startOffset - 2);
    }
    range.deleteContents();
    var bar = name.indexOf("|");
    var holder = document.createElement("span");
    holder.innerHTML = bar === -1 ? tokenHtml(name) : tokenHtml(name.slice(0, bar), name.slice(bar + 1));
    var token = holder.firstChild;
    range.insertNode(token);
    // Somewhere for the caret after it: a browser can't put one after an uneditable span at the end of a line.
    var after = token.nextSibling;
    if (!after || after.nodeType !== 3) {
      after = document.createTextNode("​");
      token.parentNode.insertBefore(after, token.nextSibling);
    }
    var caret = document.createRange();
    caret.setStart(after, after.nodeValue.charAt(0) === "​" ? 1 : 0);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
    lastRange = caret.cloneRange();
    markEmpty(el);
    sendEdit(el);
  }
  function patch(index, field, text) {
    var list = document.querySelectorAll("[" + ATTR + '="' + index + '"] [' + FIELD + '="' + field + '"]');
    for (var i = 0; i < list.length; i++) if (list[i] !== focused) draw(list[i], text);
    if (list.length) size();
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

    var fields = document.querySelectorAll("[" + FIELD + "]");
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (!where(el)) continue;
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.setAttribute("data-rww-ph", PLACEHOLDER[rich(el) ? "paragraph" : el.getAttribute(FIELD)] || "Type here");
      markEmpty(el);
    }
    // A link or an image is never dragged out of (or into) the text.
    var links = document.querySelectorAll("a, img");
    for (var j = 0; j < links.length; j++) links[j].setAttribute("draggable", "false");
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}

    document.addEventListener("focusin", function (event) {
      var el = fieldOf(event.target);
      if (!el) return;
      var at = where(el);
      if (!at) return;
      focused = el;
      lastField = el;
      send({ type: "rww-focus", index: at.index, field: at.field });
    });
    document.addEventListener("focusout", function (event) {
      var el = fieldOf(event.target);
      if (!el) return;
      saveRange();
      if (focused === el) focused = null;
      // Straight into another field: its focusin says so; no blur in between.
      if (event.relatedTarget && fieldOf(event.relatedTarget)) return;
      send({ type: "rww-blur" });
    });
    document.addEventListener("selectionchange", saveRange);
    document.addEventListener("beforeinput", function (event) {
      var el = fieldOf(event.target);
      if (!el) return;
      var type = event.inputType || "";
      if (type.indexOf("format") === 0 && !(rich(el) && type === "formatBold")) event.preventDefault();
      else if (type === "insertParagraph" && breaks(el)) {
        // A new paragraph (a phone's Enter) becomes a line break: the field stays one paragraph.
        event.preventDefault();
        document.execCommand("insertLineBreak");
      }
      else if ((type === "insertParagraph" || type === "insertLineBreak") && !rich(el) && !breaks(el)) event.preventDefault();
      else if (type === "insertFromDrop") event.preventDefault();
    });
    document.addEventListener("keydown", function (event) {
      var el = fieldOf(event.target);
      if (!el) return;
      if (event.key === "Enter" && breaks(el)) {
        event.preventDefault();
        document.execCommand("insertLineBreak");
      }
      else if (event.key === "Enter" && !rich(el)) event.preventDefault();
      else if (event.key === "Escape") el.blur();
    });
    document.addEventListener("paste", function (event) {
      var el = fieldOf(event.target);
      if (!el) return;
      // Plain text only: never someone else's markup in the mail.
      event.preventDefault();
      var text = (event.clipboardData && event.clipboardData.getData("text/plain")) || "";
      text = text.replace(/\r\n?/g, "\n");
      if (breaks(el)) text = oneBreak(text);
      else if (!rich(el)) text = text.replace(/\s*\n+\s*/g, " ");
      if (text) document.execCommand("insertText", false, text);
    });
    document.addEventListener("drop", function (event) {
      if (fieldOf(event.target)) event.preventDefault();
    });
    document.addEventListener("input", function (event) {
      var el = fieldOf(event.target);
      if (!el) return;
      markEmpty(el);
      sendEdit(el);
      saveRange();
      if (event.inputType === "insertText" && event.data && event.data.charAt(event.data.length - 1) === "{" && before(2) === "{{") send({ type: "rww-var-menu" });
    });
  }

  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "rww-select") {
      each(selected, function (el) { el.classList.remove("rww-on"); });
      selected = typeof data.index === "number" ? String(data.index) : null;
      var top = Infinity, bottom = -Infinity;
      each(selected, function (el) {
        el.classList.add("rww-on");
        var r = el.getBoundingClientRect();
        if (r.height > 0) { top = Math.min(top, r.top + window.scrollY); bottom = Math.max(bottom, r.bottom + window.scrollY); }
      });
      if (data.scroll && top !== Infinity) send({ type: "rww-at", top: top, bottom: bottom });
    } else if (!interactive) {
      return;
    } else if (data.type === "rww-patch") {
      if (typeof data.index === "number" && data.index >= 0 && Math.floor(data.index) === data.index &&
          typeof data.field === "string" && /^[a-z]{1,20}$/.test(data.field) && typeof data.text === "string") patch(data.index, data.field, data.text);
    } else if (data.type === "rww-insert-var") {
      insertVar(data.name);
    }
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
