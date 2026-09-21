// An incremental `text/event-stream` reader, shared by every feature that
// streams on a POST's own response.
//
// EventSource can only GET, so a streamed POST — a coach turn, an ATS scan —
// has to read its own body. That reading is identical everywhere and is the
// kind of thing that is subtly wrong when written twice, so it lives here
// rather than in the first feature that needed it.

export interface SseFrame {
  /** "message" when the frame named none, as the spec says. */
  event: string;
  data: string;
}

export interface SseParser {
  /** Decoded text, in pieces of any size: a frame, a line or a CRLF may be split across calls. */
  push: (text: string) => void;
  /** The stream ended. An event with no blank line after it is dropped, as the spec says. */
  end: () => void;
}

/**
 * An incremental `text/event-stream` parser, per the WHATWG HTML event-stream
 * rules: lines end in CRLF, LF or CR; a blank line dispatches the event; `data`
 * lines join with "\n"; a line starting with ":" is a comment; one space after
 * the colon is dropped. Nothing is assumed about where the network cuts the
 * body, which is the whole reason this is not a split on "\n\n".
 */
export function createSseParser(onFrame: (frame: SseFrame) => void): SseParser {
  let pending = "";
  let event = "";
  let data: string[] = [];
  // The last piece ended on a CR. If the next begins with LF, that LF is the
  // same line ending, not an empty line that would dispatch an event early.
  let afterCR = false;

  const dispatch = () => {
    const frame = data.length > 0 ? { event: event || "message", data: data.join("\n") } : null;
    event = "";
    data = [];
    if (frame) onFrame(frame);
  };

  const readLine = (line: string) => {
    if (line === "") return dispatch();
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    // `id` and `retry` mean nothing to one POST's response, and unknown fields are ignored.
  };

  return {
    push(text) {
      let chunk = text;
      if (afterCR && chunk.startsWith("\n")) chunk = chunk.slice(1);
      afterCR = false;
      const buffer = pending + chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        if (ch !== "\n" && ch !== "\r") continue;
        const line = buffer.slice(start, i);
        if (ch === "\r") {
          if (i + 1 === buffer.length) afterCR = true;
          else if (buffer[i + 1] === "\n") i++;
        }
        start = i + 1;
        // Last, because dispatching can throw (a frame this client cannot read),
        // and the cursor above must already be past the line when it does.
        readLine(line);
      }
      pending = buffer.slice(start);
    },
    end() {
      pending = "";
      event = "";
      data = [];
      afterCR = false;
    },
  };
}
