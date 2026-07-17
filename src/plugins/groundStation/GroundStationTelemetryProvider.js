import { TOPICS } from './mqttClient.js';
import { ANTENNA_TYPE } from './types.js';

const HISTORY_LIMIT = 2000;

/**
 * Merges the 5 ground-station MQTT topics into one telemetry stream. This is
 * a single-ground-station v1: every `groundStation.antenna` object shows the
 * same live merged datum, matching the one-antenna-per-deployment reality of
 * antenna-controller (see its GROUND_STATION_ID env var).
 *
 * There is no historian backend here — `history` is an in-memory ring buffer
 * covering only what's arrived since this page loaded, so historical
 * requests (e.g. plot scrollback) are empty after a reload. That's an
 * accepted v1 limitation.
 */
export default function GroundStationTelemetryProvider(mqttClient) {
  this.latest = {};
  this.history = [];
  this.subscribers = new Set();

  mqttClient.onMessage((topic, payload) => this.mergeTopic(topic, payload));
}

GroundStationTelemetryProvider.prototype.mergeTopic = function (topic, payload) {
  switch (topic) {
    case TOPICS.ANTENNA_STATUS:
      Object.assign(this.latest, {
        azimuth: payload.azimuth,
        elevation: payload.elevation,
        tracking: payload.tracking
      });
      break;

    case TOPICS.ANTENNA_RF:
      Object.assign(this.latest, {
        doppler_hz: payload.doppler_hz,
        doppler_tx_hz: payload.doppler_tx_hz,
        rssi: payload.rssi,
        snr: payload.snr,
        link_margin_db: payload.link_margin_db
      });
      break;

    case TOPICS.ANTENNA_ROTATOR:
      Object.assign(this.latest, {
        az_raw: payload.az_raw,
        el_raw: payload.el_raw
      });
      break;

    case TOPICS.HEARTBEAT:
      // renamed from payload's `status` to avoid colliding with pass `tracking_status`
      Object.assign(this.latest, {
        heartbeat_status: payload.status,
        antenna_connected: payload.antenna_connected,
        contact_id: payload.contact_id
      });
      break;

    case TOPICS.PASS_STATUS:
      Object.assign(this.latest, {
        tracking_status: payload.tracking_status,
        aos: payload.aos,
        los: payload.los,
        pass_duration_secs: payload.pass_duration_secs
      });
      break;

    default:
      return;
  }

  const datum = { ...this.latest, utc: Date.now() };
  this.history.push(datum);
  if (this.history.length > HISTORY_LIMIT) {
    this.history.shift();
  }

  this.subscribers.forEach((callback) => callback(datum));
};

GroundStationTelemetryProvider.prototype.supportsSubscribe = function (domainObject) {
  return domainObject.type === ANTENNA_TYPE;
};

GroundStationTelemetryProvider.prototype.subscribe = function (domainObject, callback) {
  this.subscribers.add(callback);
  return () => this.subscribers.delete(callback);
};

GroundStationTelemetryProvider.prototype.supportsRequest = function (domainObject) {
  return domainObject.type === ANTENNA_TYPE;
};

GroundStationTelemetryProvider.prototype.request = function (domainObject, options = {}) {
  const start = options.start ?? -Infinity;
  const end = options.end ?? Infinity;
  const inRange = this.history.filter((datum) => datum.utc >= start && datum.utc <= end);

  return Promise.resolve(inRange);
};
