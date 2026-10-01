/**
 * The admin STT lab is a development tool (owner, 2026-10-01): it is there under `next dev`, or on
 * a build served from this machine, and a 404 everywhere else, test and production included.
 * `host` is the request's Host header.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function sttLabAvailable(host: string | null): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const hostname = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}
