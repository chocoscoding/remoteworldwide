import { FC } from "react";
import { Clock } from "lucide-react";
import Chip from "./Chip";
import type { TrackState } from "./track-state";

/**
 * The state chip, rendered once for both surfaces. The clock is here rather
 * than at each call site for the reason track-state.ts exists: the hub and the
 * index must not say different things about the same track, and an icon is
 * part of what the chip says — it says "this is a time, not an outcome".
 */
const TrackStateChip: FC<{ state: TrackState; onDark?: boolean }> = ({ state, onDark = false }) => (
  <Chip tone={state.tone} onDark={onDark}>
    {/* aria-hidden: the chip already reads "Tomorrow", so a name here would
        announce the same thing twice. */}
    {state.timed && <Clock aria-hidden className="h-3 w-3" strokeWidth={2.5} />}
    {state.label}
  </Chip>
);

export default TrackStateChip;
