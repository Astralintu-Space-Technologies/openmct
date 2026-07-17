const TOKEN_STORAGE_KEY = 'groundStation.gsApiToken';

/**
 * Thin client for GS-API-JS's contact endpoints (`/auth/login`,
 * `/contacts/detailed/`), mirroring the Bearer-token-via-login pattern
 * `mcc-front/apps/web/src/lib/api.ts` already uses against the same backend —
 * NOT a Basic-Auth or hardcoded-credential scheme.
 *
 * Deliberately does not accept a username/password at construction time and
 * never persists them anywhere: credentials only ever exist in memory for the
 * duration of a single login() call. The resulting token is cached in
 * localStorage so a page reload doesn't force re-login, but nothing secret
 * ever lands in ground-station-config.json or index.html, which get
 * committed to git.
 */
export default function createGsApiClient({ baseUrl }) {
  function getStoredToken() {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function setStoredToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch (err) {
      // ignore storage errors (e.g. private browsing / storage disabled)
    }
  }

  async function login(username, password) {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error(`Login failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    const token = data.access_token || data.accessToken || data.token || data.key;
    if (!token) {
      throw new Error('Login response did not include a token');
    }

    setStoredToken(token);
    return token;
  }

  function logout() {
    setStoredToken(null);
  }

  async function getContacts({ groundStationId, reservedOnly } = {}) {
    const token = getStoredToken();
    if (!token) {
      const err = new Error('Not logged in');
      err.code = 'NOT_LOGGED_IN';
      throw err;
    }

    const params = new URLSearchParams({ include_leop_flag: 'true' });
    if (groundStationId !== undefined && groundStationId !== null && groundStationId !== '') {
      params.set('ground_station_id', groundStationId);
    }
    if (reservedOnly) {
      params.set('reserved', 'true');
    }

    const response = await fetch(`${baseUrl}/contacts/detailed/?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      setStoredToken(null);
      const err = new Error('Session expired — please log in again');
      err.code = 'NOT_LOGGED_IN';
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Contacts fetch failed: HTTP ${response.status}`);
    }

    // GS-API-JS's exact envelope for /contacts/detailed/ hasn't been directly
    // confirmed (only antenna-controller's own proxied /api/reserved_contacts,
    // which wraps it as {contacts: [...]}) — handle a bare array too rather
    // than assume one shape.
    const data = await response.json();
    return Array.isArray(data) ? data : data.contacts || data.results || [];
  }

  return { getStoredToken, login, logout, getContacts };
}
