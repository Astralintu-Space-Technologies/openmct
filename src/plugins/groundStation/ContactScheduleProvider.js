/**
 * Small polling helper (not an openmct.telemetry provider — this feeds a
 * single custom view via provide/inject, not generic telemetry consumers)
 * that reads antenna-controller's `GET /api/reserved_contacts` for the
 * current/next satellite pass. That route is proxied through
 * dashboard_proxy.py on the externally published port (default 8000),
 * same-origin with respect to `restBaseUrl`.
 */
export default function createContactScheduleClient({ restBaseUrl, pollIntervalMs = 30000 }) {
  const listeners = new Set();
  let latest = { contacts: [] };
  let timer = null;

  async function poll() {
    try {
      const response = await fetch(`${restBaseUrl}/api/reserved_contacts`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      latest = await response.json();
      listeners.forEach((callback) => callback(latest));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[groundStation] contact schedule poll failed', err);
    }
  }

  poll();
  timer = setInterval(poll, pollIntervalMs);

  return {
    getLatest() {
      return latest;
    },
    onUpdate(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    stop() {
      clearInterval(timer);
    }
  };
}
