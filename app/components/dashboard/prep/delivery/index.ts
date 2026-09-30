// The voice report's pieces. Presentational: each takes data and callbacks,
// and the report page wires them to the session queries and mutations.
//
// Everything that plays sits inside one PlaybackProvider, around the whole
// report, so the player, chips, timeline and transcript share one <audio>.

export {
  default as PlaybackProvider,
  PLAYBACK_RATES,
  usePlaybackControls,
  usePlaybackState,
  usePlaybackTime,
  useSeek,
  type PlaybackControls,
  type PlaybackProviderProps,
  type PlaybackRate,
  type PlaybackState,
  type PlaybackTimeStore,
  type SeekOptions,
} from "./PlaybackProvider";
export { default as RecordingPlayer, type RecordingPlayerProps } from "./RecordingPlayer";
export { default as TimestampChip, type TimestampChipProps } from "./TimestampChip";
export { default as DeliveryTimeline, type DeliveryTimelineProps } from "./DeliveryTimeline";
export { default as SyncedTranscript, type SyncedTranscriptProps } from "./SyncedTranscript";
export { default as DeliveryFindings, type DeliveryFindingsProps } from "./DeliveryFindings";
export { default as SummaryLines, type SummaryLinesProps } from "./SummaryLines";
export { default as AccuracyRating, type AccuracyRatingProps } from "./AccuracyRating";
export { default as AnalysisProgress, type AnalysisProgressProps } from "./AnalysisProgress";
export { default as LockedReport, type LockedReportProps } from "./LockedReport";
export { default as DeleteSessionButton, type DeleteSessionButtonProps } from "./DeleteSessionButton";
