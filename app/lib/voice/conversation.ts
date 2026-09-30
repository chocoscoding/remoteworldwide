// Mirror of remoteworldwideai/src/types/voiceConversation.ts, kept in sync by tests/contracts/voice-conversation-types.test.ts.

export const VOICE_FEATURES = ["coach", "job-ask", "interview"] as const;
export type VoiceFeature = (typeof VOICE_FEATURES)[number];

/**
 * What an interview opens with, chosen by `VOICE_INTERVIEW_OPENING`:
 *  - `greeting`: the engine speaks ELEVENLABS_ENGINE_GREETING; the reply to it is not an answer.
 *  - `browser`: no first message; the browser speaks the first question itself.
 *  - `first-question`: the engine speaks the first question.
 */
export const INTERVIEW_OPENINGS = ["greeting", "browser", "first-question"] as const;
export type InterviewOpening = (typeof INTERVIEW_OPENINGS)[number];

export const VOICE_CONVERSATION_STATUSES = ["minted", "live", "ended", "abandoned"] as const;
export type VoiceConversationStatus = (typeof VOICE_CONVERSATION_STATUSES)[number];

/** POST /api/ai/voice/conversations */
export interface MintVoiceConversationInput {
  feature: VoiceFeature;
  targetId: string;
  consent?: { version: string; accepted: boolean } | null;
}

export interface MintVoiceConversationResult {
  /** A single-use bearer credential: never logged, stored or echoed into an error. */
  signedUrl: string;
  conversationId: string;
  /** Epoch ms; a dial after this is refused. */
  expiresAt: number;
  maxDurationSeconds: number;
  remainingSeconds: number;
  /** Passed by the browser as overrides.agent.firstMessage; null when the user speaks first. */
  firstMessage: string | null;
  /** The interview's opening, which chose `firstMessage`; null for coach and job-ask. */
  opening: InterviewOpening | null;
}

/** POST /api/ai/voice/conversations/release — the id rides in the body, never the path. */
export interface ReleaseVoiceConversationInput {
  conversationId: string;
}

/** The 409 body, carried in `data`. */
export interface VoiceConversationConflict {
  conversationId: string;
  feature: VoiceFeature;
}

/** A mint's 429 from the hourly limiter, beside PrepLimited's "voice-minutes". */
export interface VoiceMintLimited {
  reason: "voice-mint";
  retryAfterMs: number | null;
}

/** GET /api/ai/voice/config */
export interface VoiceConversationConfig {
  spokenEnabled: boolean;
  features: Record<VoiceFeature, { enabled: boolean; maxDurationSeconds: number }>;
  remainingSeconds: number;
  interviewOpening: InterviewOpening;
}
