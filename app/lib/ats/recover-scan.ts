/** Bounded recovery of an incomplete scan, scoped to the caller's abort signal. */
export async function recoverScan<T extends { degraded: boolean }>(
  run: () => Promise<T>, signal: AbortSignal,
  wait: (ms: number, signal: AbortSignal) => Promise<void> = pause,
  options: { background?: boolean; retryable?: (error: unknown) => boolean; onWaiting?: (report: T) => void } = {},
): Promise<T> {
  let report = await run();
  const delays = [1500, 4000, 15000, 30000, 60000];
  for (let attempt = 0; options.background || attempt < 2; attempt++) {
    const delay = delays[Math.min(attempt, delays.length - 1)];
    signal.throwIfAborted();
    if (!report.degraded) return report;
    options.onWaiting?.(report);
    await wait(delay, signal);
    signal.throwIfAborted();
    try { report = await run(); }
    catch (error) {
      signal.throwIfAborted();
      if (!options.background || !options.retryable?.(error)) return report;
      // Keep the partial report during transient failures; never invent completion.
    }
  }
  signal.throwIfAborted();
  return report;
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
