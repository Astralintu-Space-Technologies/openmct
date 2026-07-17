export const ANTENNA_TYPE = 'groundStation.antenna';
export const SDR_TYPE = 'groundStation.sdr';
export const OVERRIDE_TYPE = 'groundStation.override';
export const CAMERA_TYPE = 'groundStation.camera';
export const CONTACTS_TYPE = 'groundStation.contacts';
export const WEATHER_TYPE = 'groundStation.weather';
export const DASHBOARD_TYPE = 'groundStation.dashboard';

/**
 * Registers the Ground Station object types. `defaults` seeds new objects'
 * configuration with the plugin's install-time options so operators don't
 * have to retype the same broker/API URLs into every object they create.
 */
export default function registerTypes(openmct, defaults = {}) {
  const {
    restBaseUrl = 'http://localhost:8000',
    waterfallWsUrl = 'ws://localhost:8765',
    mqttUrl = '',
    mqttUsername = '',
    mqttPassword = ''
  } = defaults;

  openmct.types.addType(ANTENNA_TYPE, {
    name: 'Ground Station Antenna',
    description:
      'Live AZ/EL, Doppler, SNR/RSSI, pass and heartbeat telemetry from the ground station MQTT bus.',
    cssClass: 'icon-target',
    creatable: true,
    form: [
      {
        name: 'Controller REST base URL (for satellite/pass schedule)',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'restBaseUrl',
        property: ['configuration', 'restBaseUrl']
      }
    ],
    initialize(domainObject) {
      domainObject.telemetry = {};
      domainObject.configuration = { restBaseUrl };
    }
  });

  openmct.types.addType(SDR_TYPE, {
    name: 'Ground Station SDR Waterfall',
    description:
      'Live waterfall, spectrum, and constellation views computed from raw IQ samples off a ' +
      'GNU Radio ZMQ PUB sink, via scripts/zmq-ws-bridge.py.',
    cssClass: 'icon-spectra-telemetry',
    creatable: true,
    form: [
      {
        name: 'Waterfall WebSocket URL (zmq-ws-bridge.py)',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'waterfallWsUrl',
        property: ['configuration', 'waterfallWsUrl']
      },
      {
        name: 'ZMQ address (GNU Radio ZMQ PUB sink)',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'zmqAddress',
        property: ['configuration', 'zmqAddress']
      },
      {
        name: 'Center Frequency (Hz)',
        control: 'numberfield',
        cssClass: 'l-input-sm l-numeric',
        key: 'frequency',
        property: ['configuration', 'frequency']
      },
      {
        name: 'Sample Rate (Hz)',
        control: 'numberfield',
        cssClass: 'l-input-sm l-numeric',
        key: 'sampleRate',
        property: ['configuration', 'sampleRate']
      },
      {
        name: 'FFT Size',
        control: 'numberfield',
        cssClass: 'l-input-sm l-numeric',
        key: 'fftSize',
        property: ['configuration', 'fftSize']
      },
      {
        name: 'Constellation sample count',
        control: 'numberfield',
        cssClass: 'l-input-sm l-numeric',
        key: 'constellationSize',
        property: ['configuration', 'constellationSize']
      }
    ],
    initialize(domainObject) {
      domainObject.configuration = {
        waterfallWsUrl,
        zmqAddress: 'tcp://127.0.0.1:55004',
        frequency: 437000000,
        sampleRate: 250000,
        fftSize: 1024,
        constellationSize: 512
      };
    }
  });

  openmct.types.addType(OVERRIDE_TYPE, {
    name: 'Ground Station Manual Override',
    description:
      'Manual slew/jog/park antenna controls, calling the antenna-controller REST API directly.',
    cssClass: 'icon-command',
    creatable: true,
    form: [
      {
        name: 'Controller REST base URL',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'restBaseUrl',
        property: ['configuration', 'restBaseUrl']
      }
    ],
    initialize(domainObject) {
      domainObject.configuration = { restBaseUrl };
    }
  });

  openmct.types.addType(CAMERA_TYPE, {
    name: 'Ground Station Camera',
    description:
      'Antenna camera feed. RTSP itself cannot be played directly in a browser — point this at ' +
      'an HLS (.m3u8) URL from a transcoding bridge (e.g. MediaMTX or go2rtc converting your ' +
      'RTSP source), or a raw MJPEG URL.',
    cssClass: 'icon-camera',
    creatable: true,
    form: [
      {
        name: 'Stream URL',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'streamUrl',
        property: ['configuration', 'streamUrl']
      },
      {
        name: 'Stream type',
        control: 'select',
        cssClass: 'l-input-sm',
        key: 'streamType',
        property: ['configuration', 'streamType'],
        options: [
          { name: 'HLS (.m3u8)', value: 'hls' },
          { name: 'MJPEG', value: 'mjpeg' }
        ]
      }
    ],
    initialize(domainObject) {
      domainObject.configuration = { streamUrl: '', streamType: 'hls' };
    }
  });

  openmct.types.addType(CONTACTS_TYPE, {
    name: 'Ground Station Contacts',
    description:
      'Satellite contact schedule and status pulled directly from GS-API-JS ' +
      '(GET /contacts/detailed/). Prompts for a login on first use — credentials ' +
      'are never stored in this config, only the resulting token, cached in the browser.',
    cssClass: 'icon-database',
    creatable: true,
    form: [
      {
        name: 'GS-API-JS base URL',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'gsApiUrl',
        property: ['configuration', 'gsApiUrl']
      },
      {
        name: 'Ground station ID (optional — blank shows all)',
        control: 'numberfield',
        cssClass: 'l-input-sm l-numeric',
        key: 'groundStationId',
        property: ['configuration', 'groundStationId']
      },
      {
        name: 'Reserved contacts only',
        control: 'toggleSwitch',
        cssClass: 'l-input',
        key: 'reservedOnly',
        property: ['configuration', 'reservedOnly']
      }
    ],
    initialize(domainObject) {
      domainObject.configuration = {
        gsApiUrl: 'https://develop.astralintu-egsn.com',
        groundStationId: '',
        reservedOnly: false
      };
    }
  });

  openmct.types.addType(WEATHER_TYPE, {
    name: 'Ground Station Weather',
    description:
      'Live conditions from a Davis Vantage Pro2 station via weewx’s MQTT extension. Displays ' +
      'whichever standard weewx loop-packet fields (outTemp, outHumidity, windSpeed, windDir, ' +
      'windGust, barometer, rainRate, radiation, UV, ...) are present in the topic’s JSON payload ' +
      '— fields weewx isn’t configured to send are simply omitted, not shown as blank.',
    cssClass: 'icon-brightness',
    creatable: true,
    form: [
      {
        name: 'MQTT broker URL (same broker weewx’s MQTT extension publishes to)',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'mqttUrl',
        property: ['configuration', 'mqttUrl']
      },
      {
        name: 'MQTT username',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'mqttUsername',
        property: ['configuration', 'mqttUsername']
      },
      {
        name: 'MQTT password',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'mqttPassword',
        property: ['configuration', 'mqttPassword']
      },
      {
        name: 'Weather MQTT topic',
        control: 'textfield',
        cssClass: 'l-input',
        key: 'weatherTopic',
        property: ['configuration', 'weatherTopic']
      },
      {
        name: 'weewx unit system (label formatting only — values are used as-is)',
        control: 'select',
        cssClass: 'l-input-sm',
        key: 'unitSystem',
        property: ['configuration', 'unitSystem'],
        options: [
          { name: 'US (°F, mph, inHg, in)', value: 'us' },
          { name: 'Metric (°C, km/h, mbar, mm)', value: 'metric' },
          { name: 'MetricWX (°C, m/s, mbar, mm)', value: 'metricwx' }
        ]
      }
    ],
    initialize(domainObject) {
      domainObject.configuration = {
        mqttUrl,
        mqttUsername,
        mqttPassword,
        weatherTopic: '',
        unitSystem: 'us'
      };
    }
  });

  openmct.types.addType(DASHBOARD_TYPE, {
    name: 'Ground Station Dashboard',
    description:
      'A single mission-ops screen: drop Ground Station Antenna/SDR/Manual Override/Camera ' +
      'objects into this dashboard and its Grid view renders all of their live panels together.',
    cssClass: 'icon-layout',
    creatable: true,
    initialize(domainObject) {
      domainObject.composition = [];
    }
  });
}
