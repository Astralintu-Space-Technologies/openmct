import {
  ANTENNA_TYPE,
  CAMERA_TYPE,
  CONTACTS_TYPE,
  DASHBOARD_TYPE,
  OVERRIDE_TYPE,
  SDR_TYPE,
  WEATHER_TYPE
} from './types.js';

const NAMESPACE = 'groundStation.config';

const TYPE_BY_JSON_KEY = {
  antenna: ANTENNA_TYPE,
  sdr: SDR_TYPE,
  override: OVERRIDE_TYPE,
  camera: CAMERA_TYPE,
  contacts: CONTACTS_TYPE,
  weather: WEATHER_TYPE
};

/**
 * Builds a read-only object tree straight from a JSON config — no manual
 * "Create" + drag-and-drop composition required. Edit ground-station-config.json
 * (copied into dist/ alongside index.html, see .webpack/webpack.common.mjs)
 * and reload the page to see the change: it's the source of truth for which
 * dashboards/panels exist, not anything clicked together in the UI.
 *
 * Config shape:
 * {
 *   "dashboards": [
 *     {
 *       "key": "main",
 *       "name": "Main Ground Station",
 *       "panels": [
 *         { "key": "antenna", "type": "antenna", "name": "Antenna AZ/EL", "restBaseUrl": "..." },
 *         { "key": "sdr", "type": "sdr", "name": "SDR Waterfall", "waterfallWsUrl": "...", ... },
 *         { "key": "override", "type": "override", "name": "Manual Override", "restBaseUrl": "..." },
 *         { "key": "camera", "type": "camera", "name": "Camera", "streamUrl": "" }
 *       ]
 *     }
 *   ]
 * }
 *
 * Every panel property besides key/type/name becomes that object's
 * `configuration` — the same shape the existing views already read
 * (domainObject.configuration.restBaseUrl, etc.), whether the object came
 * from this JSON or from a manually-created, form-filled one.
 */
export default function buildGroundStationConfigObjectMap(openmct, config) {
  const objectMap = {};
  const rootIdentifiers = [];

  (config.dashboards || []).forEach((dashboard) => {
    if (!dashboard.key) {
      // eslint-disable-next-line no-console
      console.warn('[groundStation] Dashboard entry missing "key" — skipped.', dashboard);
      return;
    }

    const dashboardIdentifier = { namespace: NAMESPACE, key: dashboard.key };
    const dashboardKeyString = openmct.objects.makeKeyString(dashboardIdentifier);

    const childIdentifiers = [];

    (dashboard.panels || []).forEach((panel) => {
      if (!panel.key) {
        // eslint-disable-next-line no-console
        console.warn('[groundStation] Panel entry missing "key" — skipped.', panel);
        return;
      }

      const panelType = TYPE_BY_JSON_KEY[panel.type];
      if (!panelType) {
        // eslint-disable-next-line no-console
        console.warn(
          `[groundStation] Unknown panel type "${panel.type}" for panel "${panel.key}" ` +
            '(expected one of: antenna, sdr, override, camera) — skipped.'
        );
        return;
      }

      // eslint-disable-next-line no-unused-vars -- type/name destructured only to exclude them from configuration
      const { key, type, name, ...configuration } = panel;
      const panelIdentifier = { namespace: NAMESPACE, key };
      const panelKeyString = openmct.objects.makeKeyString(panelIdentifier);

      objectMap[panelKeyString] = {
        identifier: panelIdentifier,
        name: name || key,
        type: panelType,
        location: dashboardKeyString,
        configuration,
        ...(panelType === ANTENNA_TYPE ? { telemetry: {} } : {})
      };

      childIdentifiers.push(panelIdentifier);
    });

    objectMap[dashboardKeyString] = {
      identifier: dashboardIdentifier,
      name: dashboard.name || dashboard.key,
      type: DASHBOARD_TYPE,
      location: 'ROOT',
      composition: childIdentifiers
    };

    rootIdentifiers.push(dashboardIdentifier);
  });

  return { objectMap, rootIdentifiers };
}

export function installGroundStationConfig(openmct, { config, configUrl }) {
  const loadConfig = config ? Promise.resolve(config) : fetch(configUrl).then((r) => r.json());

  const ready = loadConfig
    .then((loadedConfig) => buildGroundStationConfigObjectMap(openmct, loadedConfig))
    .then(({ objectMap, rootIdentifiers }) => {
      rootIdentifiers.forEach((identifier) => openmct.objects.addRoot(identifier));
      return objectMap;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[groundStation] Failed to load ground station config', configUrl, err);
      return {};
    });

  openmct.objects.addProvider(NAMESPACE, {
    get(identifier) {
      return ready.then((objectMap) => objectMap[openmct.objects.makeKeyString(identifier)]);
    }
  });
}
