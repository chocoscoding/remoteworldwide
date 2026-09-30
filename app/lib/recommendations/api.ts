// Browser-side calls for the candidate's recommendations.
//
// They live on the Express backend behind next.config.mjs's
// /api/recommendations rewrite, so the session cookie rides along first-party
// and the backend scopes every read to the signed-in user (someone else's id is
// a 404). The reviewers' half is NOT here: the admin screens reach
// /api/recommendations/admin through server actions (libs/recommendations-admin.ts)
// that forward the admin's session, the blog-admin pattern.

import { apiGet, apiPost } from "@/app/lib/api/client";
import type { AnswerRecommendationInput, AnswerRecommendationResult, RecommendationEligibility, RecommendationItem } from "./types";

export const RECOMMENDATIONS_PATH = "/api/recommendations";

// Ids go into the path, so they are encoded: one only ever comes from our own
// responses or the URL, but a "../" from a bad link would otherwise address a
// different route behind the same rewrite.
const at = (id: string) => `${RECOMMENDATIONS_PATH}/${encodeURIComponent(id)}`;

/** Every recommendation, live and closed, newest first. */
export const listRecommendations = (signal?: AbortSignal) => apiGet<RecommendationItem[]>(RECOMMENDATIONS_PATH, signal);

export const getRecommendation = (id: string, signal?: AbortSignal) => apiGet<RecommendationItem>(at(id), signal);

/** Whether reviewers can pick you yet: a complete profile and a master resume. */
export const getRecommendationEligibility = (signal?: AbortSignal) => apiGet<RecommendationEligibility>(`${RECOMMENDATIONS_PATH}/eligibility`, signal);

/**
 * Sends the answers to every question, once. A repeat answers with the stored
 * row and `credited: 0` rather than an error, so a retried send is harmless.
 */
export const answerRecommendation = (id: string, input: AnswerRecommendationInput) => apiPost<AnswerRecommendationResult>(`${at(id)}/answers`, input);
