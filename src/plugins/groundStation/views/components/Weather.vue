<template>
  <div class="gs-weather">
    <div v-if="!topic" class="gs-weather__hint">
      Set "MQTT broker URL" and "Weather MQTT topic" on this object to the broker/topic weewx's MQTT
      extension publishes to.
    </div>
    <template v-else>
      <div class="gs-weather__status">
        {{ connected ? `Connected — updated ${lastUpdatedText}` : statusText }}
      </div>
      <div v-if="fields.length" class="gs-weather__grid">
        <div v-for="field in fields" :key="field.key" class="gs-weather__cell">
          <div class="gs-weather__cell-label">{{ field.label }}</div>
          <div class="gs-weather__cell-value">{{ field.display }}</div>
        </div>
      </div>
      <div v-else class="gs-weather__empty">No weather data received yet.</div>
    </template>
  </div>
</template>

<script>
import mqtt from 'mqtt';

// Standard weewx loop/archive packet field names — whichever of these are
// actually present in the payload get shown; the rest are silently omitted
// rather than displayed as blank, since which fields weewx sends depends on
// its own station/skin configuration.
const FIELD_DEFS = [
  { key: 'outTemp', label: 'Temperature', unit: { us: '°F', metric: '°C', metricwx: '°C' } },
  { key: 'outHumidity', label: 'Humidity', unit: { us: '%', metric: '%', metricwx: '%' } },
  { key: 'dewpoint', label: 'Dew Point', unit: { us: '°F', metric: '°C', metricwx: '°C' } },
  {
    key: 'windSpeed',
    label: 'Wind Speed',
    unit: { us: 'mph', metric: 'km/h', metricwx: 'm/s' }
  },
  {
    key: 'windDir',
    label: 'Wind Direction',
    unit: { us: '°', metric: '°', metricwx: '°' },
    compass: true
  },
  {
    key: 'windGust',
    label: 'Wind Gust',
    unit: { us: 'mph', metric: 'km/h', metricwx: 'm/s' }
  },
  {
    key: 'barometer',
    label: 'Barometric Pressure',
    unit: { us: 'inHg', metric: 'mbar', metricwx: 'mbar' }
  },
  {
    key: 'rainRate',
    label: 'Rain Rate',
    unit: { us: 'in/hr', metric: 'mm/hr', metricwx: 'mm/hr' }
  },
  { key: 'rain', label: 'Rain (interval)', unit: { us: 'in', metric: 'mm', metricwx: 'mm' } },
  {
    key: 'radiation',
    label: 'Solar Radiation',
    unit: { us: 'W/m²', metric: 'W/m²', metricwx: 'W/m²' }
  },
  { key: 'UV', label: 'UV Index', unit: { us: '', metric: '', metricwx: '' } }
];

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW'
];

function toCompassPoint(deg) {
  if (deg === null || deg === undefined || Number.isNaN(deg)) {
    return '';
  }
  const index = Math.round((deg % 360) / 22.5) % 16;
  return COMPASS_POINTS[(index + 16) % 16];
}

export default {
  name: 'GroundStationWeather',
  inject: ['domainObject'],
  data() {
    return {
      client: null,
      connected: false,
      statusText: 'Not connected',
      latest: {},
      lastUpdated: null
    };
  },
  computed: {
    config() {
      return this.domainObject.configuration || {};
    },
    topic() {
      return this.config.weatherTopic;
    },
    unitSystem() {
      return this.config.unitSystem || 'us';
    },
    fields() {
      return FIELD_DEFS.filter((field) => this.latest[field.key] !== undefined).map((field) => {
        const value = this.latest[field.key];
        const unit = field.unit[this.unitSystem] || '';
        let display = `${value}${unit ? ` ${unit}` : ''}`;
        if (field.compass) {
          const point = toCompassPoint(value);
          display = `${value}°${point ? ` (${point})` : ''}`;
        }
        return { key: field.key, label: field.label, display };
      });
    },
    lastUpdatedText() {
      return this.lastUpdated ? this.lastUpdated.toLocaleTimeString() : '';
    }
  },
  mounted() {
    if (this.topic) {
      this.connect();
    }
  },
  beforeUnmount() {
    if (this.client) {
      this.client.end(true);
    }
  },
  methods: {
    connect() {
      this.statusText = 'Connecting…';
      this.client = mqtt.connect(this.config.mqttUrl, {
        keepalive: 30,
        username: this.config.mqttUsername,
        password: this.config.mqttPassword
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.client.subscribe(this.topic, (err) => {
          if (err) {
            // eslint-disable-next-line no-console
            console.error('[groundStation] weather MQTT subscribe error', err);
          }
        });
      });

      this.client.on('reconnect', () => {
        this.connected = false;
        this.statusText = 'Reconnecting…';
      });

      this.client.on('close', () => {
        this.connected = false;
        this.statusText = 'Disconnected';
      });

      this.client.on('error', (err) => {
        this.connected = false;
        this.statusText = `Connection error: ${err.message}`;
      });

      this.client.on('message', (_topic, buffer) => {
        try {
          this.latest = { ...this.latest, ...JSON.parse(buffer.toString()) };
          this.lastUpdated = new Date();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[groundStation] non-JSON weather MQTT payload', err);
        }
      });
    }
  }
};
</script>
