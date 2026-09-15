/**
 * Small fetch helpers. Every request is bounded by a timeout so that a slow
 * network can never hold the boot sequence back: whatever has not arrived by
 * the time its cue fires is simply reported as unavailable.
 */

const USER_AGENT = "jarek-cli";

async function request(url, { timeout = 4000, headers = {} } = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: { "user-agent": USER_AGENT, ...headers },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function fetchJson(url, options) {
  const res = await request(url, options);
  return res.json();
}

export async function fetchText(url, options) {
  const res = await request(url, options);
  return res.text();
}

/** Resolves to `null` instead of rejecting, so tasks can be raced without care. */
export function optional(promise) {
  return promise.then(
    (value) => value,
    () => null,
  );
}
