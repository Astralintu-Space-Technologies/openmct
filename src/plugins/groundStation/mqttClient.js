import mqtt from 'mqtt';

/**
 * Ground-station-level MQTT topics published by antenna-controller's
 * gs_status_publisher.py. These are static, single-ground-station topics —
 * distinct from mcc-front's dynamic per-satellite `{group}/{noradId}/telemetry/rf`
 * convention, which this plugin does not use.
 */
export const TOPICS = {
  ANTENNA_STATUS: 'gs/antenna/status',
  ANTENNA_RF: 'gs/antenna/rf',
  ANTENNA_ROTATOR: 'gs/antenna/rotator',
  HEARTBEAT: 'gs/heartbeat',
  PASS_STATUS: 'gs/pass/status'
};

/**
 * Thin wrapper around mqtt.js matching the connection pattern already used
 * by mcc-front's useAntennaStatus.ts (`mqtt.connect(url, { keepalive: 30,
 * username, password })`, subscribe-all-on-connect, track connected/error).
 *
 * Returns a no-op client (never connects) if no URL is configured, so the
 * plugin can install cleanly before an operator fills in the broker URL.
 */
export default function createGroundStationMqttClient({ url, username, password } = {}) {
  const listeners = new Set();
  const state = { connected: false, lastSeen: null, error: null };

  if (!url) {
    // eslint-disable-next-line no-console
    console.warn(
      '[groundStation] No mqttUrl configured — antenna/RF/pass/heartbeat telemetry will not connect. ' +
        'Pass { mqttUrl, mqttUsername, mqttPassword } to GroundStationPlugin(...).'
    );

    return {
      onMessage() {
        return () => {};
      },
      getState() {
        return state;
      },
      disconnect() {}
    };
  }

  const client = mqtt.connect(url, { keepalive: 30, username, password });

  client.on('connect', () => {
    state.connected = true;
    state.error = null;
    client.subscribe(Object.values(TOPICS), (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[groundStation] MQTT subscribe error', err);
      }
    });
  });

  client.on('reconnect', () => {
    state.connected = false;
  });

  client.on('close', () => {
    state.connected = false;
  });

  client.on('error', (err) => {
    state.error = err;
  });

  client.on('message', (topic, buffer) => {
    state.lastSeen = new Date();

    let payload;
    try {
      payload = JSON.parse(buffer.toString());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[groundStation] Non-JSON MQTT payload on', topic, err);
      return;
    }

    listeners.forEach((callback) => callback(topic, payload));
  });

  return {
    onMessage(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getState() {
      return state;
    },
    disconnect() {
      client.end(true);
    }
  };
}
