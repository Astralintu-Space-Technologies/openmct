import GroundStationCompositionPolicy from './GroundStationCompositionPolicy.js';
import { installGroundStationConfig } from './GroundStationConfigProvider.js';
import GroundStationLimitProvider from './GroundStationLimitProvider.js';
import GroundStationMetadataProvider from './GroundStationMetadataProvider.js';
import GroundStationTelemetryProvider from './GroundStationTelemetryProvider.js';
import createGroundStationMqttClient from './mqttClient.js';
import registerTypes from './types.js';
import AntennaCompassViewProvider from './views/AntennaCompassView.js';
import CameraViewProvider from './views/CameraView.js';
import ContactsViewProvider from './views/ContactsView.js';
import GroundStationGridViewProvider from './views/GroundStationGridView.js';
import ManualOverrideViewProvider from './views/ManualOverrideView.js';
import PassProgressViewProvider from './views/PassProgressView.js';
import SdrWaterfallViewProvider from './views/SdrWaterfallView.js';
import WeatherViewProvider from './views/WeatherView.js';

/**
 * @param {Object} [options]
 * @param {string} [options.mqttUrl] e.g. "wss://your-mqtt-endpoint:9001" — same broker mcc-front uses
 * @param {string} [options.mqttUsername]
 * @param {string} [options.mqttPassword]
 * @param {string} [options.restBaseUrl] antenna-controller's dashboard_proxy origin, default "http://localhost:8000"
 * @param {string} [options.waterfallWsUrl] SDR waterfall bridge, default "ws://localhost:8765"
 * @param {Object} [options.config] inline dashboards/panels config (see GroundStationConfigProvider.js)
 *   — takes precedence over configUrl if both are given.
 * @param {string} [options.configUrl] URL of a JSON config file describing dashboards/panels,
 *   default "ground-station-config.json". This is what actually defines which dashboards and
 *   panels exist — edit that file (or pass options.config) rather than clicking through
 *   Create/drag-and-drop in the UI.
 */
export default function GroundStationPlugin(options = {}) {
  return function install(openmct) {
    registerTypes(openmct, {
      restBaseUrl: options.restBaseUrl,
      waterfallWsUrl: options.waterfallWsUrl,
      mqttUrl: options.mqttUrl,
      mqttUsername: options.mqttUsername,
      mqttPassword: options.mqttPassword
    });

    installGroundStationConfig(openmct, {
      config: options.config,
      configUrl: options.configUrl || 'ground-station-config.json'
    });

    const mqttClient = createGroundStationMqttClient({
      url: options.mqttUrl,
      username: options.mqttUsername,
      password: options.mqttPassword
    });

    openmct.telemetry.addProvider(new GroundStationTelemetryProvider(mqttClient));
    openmct.telemetry.addProvider(new GroundStationMetadataProvider());
    openmct.telemetry.addProvider(new GroundStationLimitProvider());

    openmct.objectViews.addProvider(new AntennaCompassViewProvider(openmct));
    openmct.objectViews.addProvider(new PassProgressViewProvider(openmct));
    openmct.objectViews.addProvider(new SdrWaterfallViewProvider(openmct));
    openmct.objectViews.addProvider(new ManualOverrideViewProvider(openmct));
    openmct.objectViews.addProvider(new CameraViewProvider(openmct));
    openmct.objectViews.addProvider(new ContactsViewProvider(openmct));
    openmct.objectViews.addProvider(new WeatherViewProvider(openmct));
    openmct.objectViews.addProvider(new GroundStationGridViewProvider(openmct));

    openmct.composition.addPolicy(new GroundStationCompositionPolicy().allow);
  };
}
