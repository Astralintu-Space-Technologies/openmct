<template>
  <div class="gs-override">
    <div v-if="!restBaseUrl" class="gs-override__hint">
      Set "Controller REST base URL" on this object (e.g. http://localhost:8000,
      antenna-controller's dashboard_proxy origin) to enable controls.
    </div>
    <template v-else>
      <div class="gs-override__section">
        <h3>Slew to position</h3>
        <label
          >Azimuth (deg)
          <input v-model.number="targetAz" type="number" min="0" max="360" step="0.1" />
        </label>
        <label
          >Elevation (deg)
          <input v-model.number="targetEl" type="number" min="0" max="180" step="0.1" />
        </label>
        <button :disabled="busy" @click="slew">Slew</button>
      </div>

      <div class="gs-override__section">
        <h3>Jog</h3>
        <label
          >Step (deg) <input v-model.number="jogStep" type="number" min="0.1" step="0.1"
        /></label>
        <div class="gs-override__jog-pad">
          <button :disabled="busy" @click="jog(0, jogStep)">EL +</button>
          <button :disabled="busy" @click="jog(-jogStep, 0)">AZ -</button>
          <button :disabled="busy" @click="jog(jogStep, 0)">AZ +</button>
          <button :disabled="busy" @click="jog(0, -jogStep)">EL -</button>
        </div>
      </div>

      <div class="gs-override__section">
        <h3>Emergency</h3>
        <button class="gs-override__park-btn" :disabled="busy" @click="park">EMERGENCY PARK</button>
      </div>

      <div v-if="statusMessage" class="gs-override__status" :class="{ 'is-error': statusIsError }">
        {{ statusMessage }}
      </div>

      <div class="gs-override__ptt">
        <span class="gs-override__label">PTT</span>
        <span class="gs-override__badge">NOT WIRED — no PTT source exists in the stack yet</span>
      </div>

      <div class="gs-override__section">
        <h3>Recent Commands</h3>
        <ul class="gs-override__log">
          <li v-if="!commandLog.length" class="gs-override__log-empty">No commands sent yet.</li>
          <li
            v-for="entry in commandLog"
            :key="entry.id"
            class="gs-override__log-entry"
            :class="`is-${entry.status}`"
          >
            <span class="gs-override__log-time">{{ formatTime(entry.timestamp) }}</span>
            <span class="gs-override__log-label">{{ entry.label }}</span>
            <span class="gs-override__log-status">{{ entry.status }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script>
const COMMAND_LOG_LIMIT = 20;

export default {
  inject: ['domainObject'],
  data() {
    return {
      targetAz: 0,
      targetEl: 0,
      jogStep: 1,
      currentAz: 0,
      currentEl: 0,
      busy: false,
      statusMessage: '',
      statusIsError: false,
      commandLog: []
    };
  },
  computed: {
    restBaseUrl() {
      return this.domainObject.configuration && this.domainObject.configuration.restBaseUrl;
    }
  },
  methods: {
    logCommand(label) {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
        label,
        status: 'pending'
      };
      this.commandLog.unshift(entry);
      this.commandLog.length = Math.min(this.commandLog.length, COMMAND_LOG_LIMIT);
      return entry;
    },
    async postJson(path, body, logEntry) {
      this.busy = true;
      this.statusMessage = '';
      this.statusIsError = false;
      try {
        const response = await fetch(`${this.restBaseUrl}${path}`, {
          method: 'POST',
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.detail || data.message || `HTTP ${response.status}`);
        }
        this.statusMessage = data.message || 'OK';
        if (logEntry) {
          logEntry.status = 'success';
        }
        return data;
      } catch (err) {
        this.statusIsError = true;
        this.statusMessage = err.message;
        if (logEntry) {
          logEntry.status = 'error';
        }
        return null;
      } finally {
        this.busy = false;
      }
    },
    async slew() {
      this.currentAz = this.targetAz;
      this.currentEl = this.targetEl;
      const entry = this.logCommand(`Slew to ${this.targetAz}°/${this.targetEl}°`);
      await this.postJson(
        '/test/antenna/move',
        { azimuth: this.targetAz, elevation: this.targetEl },
        entry
      );
    },
    async jog(deltaAz, deltaEl) {
      const newAz = Math.min(360, Math.max(0, this.currentAz + deltaAz));
      const newEl = Math.min(180, Math.max(0, this.currentEl + deltaEl));
      this.currentAz = newAz;
      this.currentEl = newEl;
      this.targetAz = newAz;
      this.targetEl = newEl;
      const axis = deltaAz !== 0 ? 'AZ' : 'EL';
      const delta = deltaAz !== 0 ? deltaAz : deltaEl;
      const entry = this.logCommand(`Jog ${axis} ${delta > 0 ? '+' : ''}${delta}°`);
      await this.postJson('/test/antenna/move', { azimuth: newAz, elevation: newEl }, entry);
    },
    async park() {
      // eslint-disable-next-line no-alert
      if (!window.confirm('Park the antenna and halt motion?')) {
        return;
      }
      const entry = this.logCommand('EMERGENCY PARK');
      await this.postJson('/api/emergency_park', undefined, entry);
    },
    formatTime(date) {
      return date.toLocaleTimeString();
    }
  }
};
</script>
