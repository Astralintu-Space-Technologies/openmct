// Real MQTT credentials go in local-env.js (gitignored), not here and not in
// index.html/ground-station-config.json — both of those are tracked in git.
//
//   cp local-env.example.js local-env.js
//   # then fill in the real values below in local-env.js
//
// index.html loads local-env.js before the bootstrap script and uses these
// as the main plugin's MQTT credentials. GroundStationConfigProvider.js also
// falls back to these for any per-panel config (e.g. the Weather panel) that
// has an empty mqttUsername/mqttPassword field in ground-station-config.json,
// so you don't have to repeat the same secret in two places.

window.GS_MQTT_USERNAME = '';
window.GS_MQTT_PASSWORD = '';
