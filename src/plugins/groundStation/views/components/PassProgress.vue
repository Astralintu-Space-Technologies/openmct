<template>
  <div class="gs-pass">
    <div class="gs-pass__row">
      <span class="gs-pass__label">Satellite</span>
      <span class="gs-pass__value">{{ satelliteName || '—' }}</span>
    </div>
    <div class="gs-pass__row">
      <span class="gs-pass__label">Status</span>
      <span class="gs-pass__value">{{ trackingStatus || 'Idle' }}</span>
    </div>
    <div v-if="aos !== null" class="gs-pass__row">
      <span class="gs-pass__label">AOS in</span>
      <span class="gs-pass__value">{{ formatCountdown(aos) }}</span>
    </div>
    <div v-if="los !== null" class="gs-pass__row">
      <span class="gs-pass__label">LOS in</span>
      <span class="gs-pass__value">{{ formatCountdown(los) }}</span>
    </div>
    <div v-if="progressPct !== null" class="gs-pass__progress-track">
      <div class="gs-pass__progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>
    <div v-if="!restBaseUrl" class="gs-pass__hint">
      Set "Controller REST base URL" on this object to show the current satellite/schedule.
    </div>
  </div>
</template>

<script>
import createContactScheduleClient from '../../ContactScheduleProvider.js';

export default {
  inject: ['openmct', 'domainObject'],
  data() {
    return {
      trackingStatus: null,
      aos: null,
      los: null,
      passDurationSecs: null,
      satelliteName: null,
      unsubscribeTelemetry: null,
      scheduleClient: null,
      unsubscribeSchedule: null
    };
  },
  computed: {
    restBaseUrl() {
      return this.domainObject.configuration && this.domainObject.configuration.restBaseUrl;
    },
    progressPct() {
      if (this.aos !== null && this.aos > 0) {
        return 0;
      }
      if (this.los !== null && this.passDurationSecs) {
        const elapsed = this.passDurationSecs - this.los;
        return Math.max(0, Math.min(100, (elapsed / this.passDurationSecs) * 100));
      }
      return null;
    }
  },
  mounted() {
    this.unsubscribeTelemetry = this.openmct.telemetry.subscribe(this.domainObject, (datum) => {
      if (datum.tracking_status !== undefined) {
        this.trackingStatus = datum.tracking_status;
      }
      if (datum.aos !== undefined) {
        this.aos = datum.aos;
      }
      if (datum.los !== undefined) {
        this.los = datum.los;
      }
      if (datum.pass_duration_secs !== undefined) {
        this.passDurationSecs = datum.pass_duration_secs;
      }
    });

    if (this.restBaseUrl) {
      this.scheduleClient = createContactScheduleClient({ restBaseUrl: this.restBaseUrl });
      this.unsubscribeSchedule = this.scheduleClient.onUpdate((data) => this.applySchedule(data));
      this.applySchedule(this.scheduleClient.getLatest());
    }
  },
  beforeUnmount() {
    if (this.unsubscribeTelemetry) {
      this.unsubscribeTelemetry();
    }
    if (this.unsubscribeSchedule) {
      this.unsubscribeSchedule();
    }
    if (this.scheduleClient) {
      this.scheduleClient.stop();
    }
  },
  methods: {
    applySchedule(data) {
      const contacts = (data && data.contacts) || [];
      const next = contacts[0];
      this.satelliteName = next ? next.satellite_name : null;
    },
    formatCountdown(seconds) {
      if (seconds === null || seconds === undefined) {
        return '--';
      }
      const total = Math.max(0, Math.round(seconds));
      const minutes = Math.floor(total / 60);
      const remainder = total % 60;
      return `${minutes}:${String(remainder).padStart(2, '0')}`;
    }
  }
};
</script>
