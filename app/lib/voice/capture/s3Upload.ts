// One recording part to storage by presigned PUT.
//
// The browser talks to S3 directly: audio never passes through Next (Vercel
// caps request bodies and bills every second a function holds one) nor through
// the AI service. The AI service signs a POST policy for one exact key, a size
// range and a 15-minute expiry, and this sends the part under it.
//
// S3 answers a failed POST with an XML body like
//   <Error><Code>AccessDenied</Code><Message>Invalid according to Policy: Policy expired.</Message>…</Error>
// and what the part queue needs from it is only what to do next: fetch a fresh
// URL, back off and try again, or give up on this part. That mapping lives
// here, so the queue (partQueue.ts) stays free of S3's vocabulary.
//
// Nothing here logs, and no error carries the URL or the policy: both are
// credentials for as long as they last.

import type { PartUrl } from "@/app/lib/voice/types";
import type { PartUploadErrorKind, PartUploadFailure } from "./partQueue";

/** A part S3 did not store. `code` is S3's error code, or `network` / `http-<status>` when it gave none. */
export class S3UploadError extends Error implements PartUploadFailure {
  constructor(
    public readonly kind: PartUploadErrorKind,
    public readonly code: string,
    /** The HTTP status; null when no response arrived. */
    public readonly status: number | null,
  ) {
    super(`The recording part was not stored (${code}).`);
    this.name = "S3UploadError";
  }
}

// The URL itself is no good any more; a freshly signed one is the fix. The
// signature and key-id codes belong here too: they mean the credentials that
// signed the URL were rotated or expired (role credentials last hours), which a
// new signature fixes and a retry of the same one never will.
const EXPIRED_CODES: ReadonlySet<string> = new Set([
  "ExpiredToken",
  "TokenRefreshRequired",
  "RequestExpired",
  "RequestTimeTooSkewed",
  "InvalidAccessKeyId",
  "InvalidToken",
  "SignatureDoesNotMatch",
]);

// S3 or the connection had a moment.
const RETRYABLE_CODES: ReadonlySet<string> = new Set(["InternalError", "ServiceUnavailable", "SlowDown", "RequestTimeout", "OperationAborted"]);

// The part itself is wrong, and will be every time.
const FATAL_CODES: ReadonlySet<string> = new Set([
  "EntityTooLarge",
  "EntityTooSmall",
  "IncorrectNumberOfFilesInPostRequest",
  "InvalidArgument",
  "InvalidPolicyDocument",
  "MalformedPOSTRequest",
  "MaxPostPreDataLengthExceeded",
  "MissingFields",
  "NoSuchBucket",
]);

/** S3's `<Code>` and `<Message>`, or nulls when the body is not S3's error document. */
export function parseS3Error(body: string): { code: string | null; message: string | null } {
  const pick = (tag: string): string | null => {
    const match = new RegExp(`<${tag}>([^<]{1,512})</${tag}>`).exec(body);
    return match ? match[1].trim() : null;
  };
  return { code: pick("Code"), message: pick("Message") };
}

/** What the part queue should do after S3 answered `status` with this error. */
export function classifyS3Error(status: number, code: string | null, message: string | null): PartUploadFailure {
  if (code && EXPIRED_CODES.has(code)) return { kind: "expired", code };
  if (code === "AccessDenied") {
    // A POST policy past its expiry is an AccessDenied with this message, not
    // a code of its own.
    if (message && /policy expired|request has expired/i.test(message)) return { kind: "expired", code: "PolicyExpired" };
    // A condition the part broke (its size, its key) fails the same way again.
    if (message && /policy condition failed|invalid according to policy/i.test(message)) return { kind: "fatal", code };
    // Anything else denied: a fresh signature is the only thing worth trying,
    // and the queue bounds how often.
    return { kind: "expired", code };
  }
  if (code && RETRYABLE_CODES.has(code)) return { kind: "retryable", code };
  if (code && FATAL_CODES.has(code)) return { kind: "fatal", code };
  const label = code ?? `http-${status}`;
  if (status >= 500 || status === 408 || status === 429) return { kind: "retryable", code: label };
  if (status === 403) return { kind: "expired", code: label };
  return { kind: status >= 400 ? "fatal" : "retryable", code: label };
}

/**
 * Sends one part. Resolves once storage has stored it (200, 201 or 204).
 * Rejects with an S3UploadError, or with the AbortError itself when `signal`
 * aborted, so the queue can tell a cancel from a failure.
 *
 * A PUT with the part as the body: R2 does not implement POST object, so the
 * multipart form this used to send could never have uploaded anything. The
 * headers come from the signer and must be sent exactly — Content-Type is
 * signed, and a mismatch is a 403 that looks nothing like a type error.
 */
export async function putPart(partUrl: PartUrl, part: Blob, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(partUrl.url, {
      method: "PUT",
      body: part,
      headers: partUrl.headers,
      signal,
      // Storage needs no cookie of ours, and must not be sent one.
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    // Offline, DNS, a CORS refusal: nothing S3 said, so worth another try.
    throw new S3UploadError("retryable", "network", null);
  }

  if (res.ok) {
    await res.body?.cancel().catch(() => {});
    return;
  }
  const body = await res.text().catch(() => "");
  const { code, message } = parseS3Error(body);
  const failure = classifyS3Error(res.status, code, message);
  throw new S3UploadError(failure.kind, failure.code, res.status);
}
