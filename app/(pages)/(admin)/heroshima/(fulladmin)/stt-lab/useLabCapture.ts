"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createLabCapture, type LabCapture, type LabCaptureSnapshot } from "./labCapture";

/**
 * The lab's capture engine for one page. The engine is created once and
 * outlives re-renders; React sees its snapshot. Unmounting drops a clip still
 * recording (nothing is uploaded), while an upload already under way finishes
 * by itself. The engine stays usable afterwards, so StrictMode's
 * mount, unmount, mount does no harm.
 */
export function useLabCapture(): { snapshot: LabCaptureSnapshot; engine: LabCapture } {
  const [engine] = useState(createLabCapture);
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  useEffect(() => () => engine.dispose(), [engine]);
  return { snapshot, engine };
}
