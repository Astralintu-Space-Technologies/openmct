<template>
  <div class="gs-contacts">
    <form v-if="!loggedIn" class="gs-contacts__login" @submit.prevent="doLogin">
      <p class="gs-contacts__login-hint">Log in to GS-API-JS to see contact schedule/status.</p>
      <label>Username <input v-model="username" type="text" autocomplete="username" /></label>
      <label
        >Password
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <button type="submit" :disabled="loggingIn">
        {{ loggingIn ? 'Logging in…' : 'Log in' }}
      </button>
      <div v-if="loginError" class="gs-contacts__error">{{ loginError }}</div>
    </form>

    <template v-else>
      <div class="gs-contacts__toolbar">
        <span class="gs-contacts__refreshed">
          {{ lastRefreshed ? `Updated ${formatTime(lastRefreshed)}` : 'Loading…' }}
        </span>
        <button :disabled="loading" @click="refresh">Refresh</button>
        <button class="gs-contacts__logout" @click="doLogout">Log out</button>
      </div>

      <div v-if="loadError" class="gs-contacts__error">{{ loadError }}</div>

      <table v-if="contacts.length" class="gs-contacts__table">
        <thead>
          <tr>
            <th>Satellite</th>
            <th>NORAD</th>
            <th>Status</th>
            <th>Start</th>
            <th>End</th>
            <th>Max El</th>
            <th>LEOP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="contact in contacts" :key="contact.contact_id">
            <td>{{ contact.satellite_name }}</td>
            <td>{{ contact.norad_id }}</td>
            <td>{{ contact.status }}</td>
            <td>{{ formatDateTime(contact.start_datetime) }}</td>
            <td>{{ formatDateTime(contact.end_datetime) }}</td>
            <td>{{ formatElevation(contact.max_elevation_angle_degrees) }}</td>
            <td>
              <span v-if="contact.is_leop" class="gs-contacts__leop-badge">LEOP</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="!loading" class="gs-contacts__empty">No contacts found.</div>
    </template>
  </div>
</template>

<script>
import createGsApiClient from '../../GsApiClient.js';

const POLL_INTERVAL_MS = 30000;

export default {
  name: 'GroundStationContacts',
  inject: ['domainObject'],
  data() {
    return {
      client: null,
      loggedIn: false,
      username: '',
      password: '',
      loggingIn: false,
      loginError: '',
      contacts: [],
      loading: false,
      loadError: '',
      lastRefreshed: null,
      pollTimer: null
    };
  },
  computed: {
    config() {
      return this.domainObject.configuration || {};
    }
  },
  mounted() {
    this.client = createGsApiClient({ baseUrl: this.config.gsApiUrl });
    this.loggedIn = Boolean(this.client.getStoredToken());
    if (this.loggedIn) {
      this.startPolling();
    }
  },
  beforeUnmount() {
    this.stopPolling();
  },
  methods: {
    async doLogin() {
      this.loggingIn = true;
      this.loginError = '';
      try {
        await this.client.login(this.username, this.password);
        this.password = '';
        this.loggedIn = true;
        this.startPolling();
      } catch (err) {
        this.loginError = err.message;
      } finally {
        this.loggingIn = false;
      }
    },
    doLogout() {
      this.stopPolling();
      this.client.logout();
      this.loggedIn = false;
      this.contacts = [];
    },
    startPolling() {
      this.refresh();
      this.pollTimer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async refresh() {
      this.loading = true;
      this.loadError = '';
      try {
        this.contacts = await this.client.getContacts({
          groundStationId: this.config.groundStationId,
          reservedOnly: this.config.reservedOnly
        });
        this.lastRefreshed = new Date();
      } catch (err) {
        this.loadError = err.message;
        if (err.code === 'NOT_LOGGED_IN') {
          this.stopPolling();
          this.loggedIn = false;
        }
      } finally {
        this.loading = false;
      }
    },
    formatTime(date) {
      return date.toLocaleTimeString();
    },
    formatDateTime(value) {
      if (!value) {
        return '--';
      }
      return new Date(value).toLocaleString();
    },
    formatElevation(value) {
      return value === undefined || value === null ? '--' : `${Number(value).toFixed(1)}°`;
    }
  }
};
</script>
