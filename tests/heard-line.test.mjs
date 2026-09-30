// The interviewer's line as it is heard (app/lib/voice/capture/engineSession.ts
// `heardLine`): each audio chunk's characters are released at their own time in
// the audio, a chunk plays after the one before it, the screen is told word by
// word, and a line cut off by the candidate keeps only what was heard.
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = target.startsWith(".") || target.startsWith("file:");
    if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(target, context);
  },
});

const { heardLine } = await import("../app/lib/voice/capture/engineSession.ts");

/** A chunk of `text`, one character every `stepMs`. */
const chunk = (text, stepMs = 50) => ({
  chars: [...text],
  char_start_times_ms: [...text].map((_, i) => i * stepMs),
  char_durations_ms: [...text].map(() => stepMs),
});

/**
 * A line on a clock the test moves by hand, recording everything the screen
 * was told. Stopped however the test ends: a live interval would hold the run open.
 */
async function withLine(run) {
  let now = 1000;
  const seen = [];
  const heard = heardLine((text) => seen.push(text), () => now);
  try {
    await run({ heard, seen, advance: async (ms) => ((now += ms), await wait(60)) });
  } finally {
    heard.stop();
  }
}

describe("heardLine", () => {
  it("tells the screen word by word, never mid-word, even when a tick releases several words", () =>
    withLine(async ({ heard, seen, advance }) => {
      heard.add(chunk("Tell me more")); // T=0 … "Tell m" by 250ms
      await advance(260);
      assert.equal(seen.at(-1), "Tell ", "the half-said 'me' waits for its end");
      assert.ok(seen.every((s) => /[\s.]$/.test(s)));
      await advance(1000);
      assert.equal(seen.at(-1), "Tell me more", "the end of the line is the end of a word");
    }));

  it("plays a chunk after the one before it has finished", () =>
    withLine(async ({ heard, seen, advance }) => {
      heard.add(chunk("One. ")); // 5 chars at 50ms: runs to 250ms
      heard.add(chunk("Two."));
      await advance(240);
      assert.equal(seen.at(-1), "One. ", "the second chunk isn't due until the first one ends");
      await advance(500);
      assert.equal(seen.at(-1), "One. Two.");
    }));

  it("drops what was queued but not heard when the line is cut off", () =>
    withLine(async ({ heard, seen, advance }) => {
      heard.add(chunk("Walk me through it"));
      await advance(410); // "Walk me " is heard by 350ms
      heard.stop();
      await advance(5000);
      assert.equal(seen.at(-1), "Walk me ");
    }));

  it("starts the next line from nothing after a reset", () =>
    withLine(async ({ heard, seen, advance }) => {
      heard.add(chunk("First."));
      await advance(1000);
      heard.reset();
      heard.add(chunk("Second."));
      await advance(1000);
      assert.equal(seen.at(-1), "Second.");
    }));
});
