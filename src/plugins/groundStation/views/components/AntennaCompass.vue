<template>
  <div class="gs-compass">
    <svg viewBox="0 0 200 200" class="gs-compass__dial">
      <circle cx="100" cy="100" r="90" class="gs-compass__ring" />
      <circle cx="100" cy="100" r="60" class="gs-compass__ring gs-compass__ring--inner" />
      <text
        v-for="tick in ticks"
        :key="tick.label"
        :x="tick.x"
        :y="tick.y"
        class="gs-compass__tick"
        text-anchor="middle"
      >
        {{ tick.label }}
      </text>
      <line x1="100" y1="100" :x2="needle.x" :y2="needle.y" class="gs-compass__needle" />
      <circle cx="100" cy="100" r="5" class="gs-compass__hub" />
    </svg>
    <div class="gs-compass__readout">
      <div class="gs-compass__row">
        <span class="gs-compass__label">AZ</span>
        <span class="gs-compass__value">{{ formatDeg(azimuth) }}</span>
      </div>
      <div class="gs-compass__row">
        <span class="gs-compass__label">EL</span>
        <span class="gs-compass__value">{{ formatDeg(elevation) }}</span>
      </div>
      <div class="gs-compass__status" :class="{ 'is-tracking': tracking }">
        {{ tracking ? 'TRACKING' : 'IDLE' }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  inject: ['openmct', 'domainObject'],
  data() {
    return {
      azimuth: null,
      elevation: null,
      tracking: false,
      unsubscribe: null
    };
  },
  computed: {
    ticks() {
      return [0, 90, 180, 270].map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return {
          label: `${deg}°`,
          x: 100 + 78 * Math.cos(rad),
          y: 100 + 78 * Math.sin(rad) + 4
        };
      });
    },
    needle() {
      const az = this.azimuth ?? 0;
      const rad = ((az - 90) * Math.PI) / 180;
      return {
        x: 100 + 82 * Math.cos(rad),
        y: 100 + 82 * Math.sin(rad)
      };
    }
  },
  mounted() {
    this.openmct.telemetry.request(this.domainObject, { size: 1 }).then((data) => {
      if (data && data.length) {
        this.applyDatum(data[data.length - 1]);
      }
    });

    this.unsubscribe = this.openmct.telemetry.subscribe(this.domainObject, (datum) => {
      this.applyDatum(datum);
    });
  },
  beforeUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  },
  methods: {
    applyDatum(datum) {
      if (datum.azimuth !== undefined) {
        this.azimuth = datum.azimuth;
      }
      if (datum.elevation !== undefined) {
        this.elevation = datum.elevation;
      }
      if (datum.tracking !== undefined) {
        this.tracking = datum.tracking;
      }
    },
    formatDeg(value) {
      return value === null || value === undefined ? '--' : `${value.toFixed(1)}°`;
    }
  }
};
</script>
