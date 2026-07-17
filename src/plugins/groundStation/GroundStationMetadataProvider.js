import { ANTENNA_TYPE } from './types.js';

const VALUES = [
  { key: 'utc', name: 'Time', format: 'utc', hints: { domain: 1 } },
  {
    key: 'azimuth',
    name: 'Azimuth',
    unit: 'deg',
    formatString: '%0.2f',
    hints: { range: 1 }
  },
  {
    key: 'elevation',
    name: 'Elevation',
    unit: 'deg',
    formatString: '%0.2f',
    hints: { range: 2 }
  },
  {
    key: 'az_raw',
    name: 'Azimuth (raw encoder)',
    unit: 'deg',
    formatString: '%0.2f',
    hints: { range: 3 }
  },
  {
    key: 'el_raw',
    name: 'Elevation (raw encoder)',
    unit: 'deg',
    formatString: '%0.2f',
    hints: { range: 4 }
  },
  { key: 'tracking', name: 'Tracking', format: 'boolean', hints: { range: 5 } },
  {
    key: 'doppler_hz',
    name: 'Doppler (RX)',
    unit: 'Hz',
    formatString: '%0.1f',
    hints: { range: 6 }
  },
  {
    key: 'doppler_tx_hz',
    name: 'Doppler (TX)',
    unit: 'Hz',
    formatString: '%0.1f',
    hints: { range: 7 }
  },
  { key: 'snr', name: 'SNR', unit: 'dB', formatString: '%0.1f', hints: { range: 8 } },
  { key: 'rssi', name: 'RSSI', unit: 'dBm', formatString: '%0.1f', hints: { range: 9 } },
  {
    key: 'link_margin_db',
    name: 'Link Margin',
    unit: 'dB',
    formatString: '%0.1f',
    hints: { range: 10 }
  },
  { key: 'tracking_status', name: 'Tracking Status', format: 'string', hints: { range: 11 } },
  { key: 'aos', name: 'AOS', unit: 's', formatString: '%0.0f', hints: { range: 12 } },
  { key: 'los', name: 'LOS', unit: 's', formatString: '%0.0f', hints: { range: 13 } },
  {
    key: 'pass_duration_secs',
    name: 'Pass Duration',
    unit: 's',
    formatString: '%0.0f',
    hints: { range: 14 }
  },
  { key: 'heartbeat_status', name: 'GS Heartbeat', format: 'string', hints: { range: 15 } },
  {
    key: 'antenna_connected',
    name: 'Antenna Connected',
    format: 'boolean',
    hints: { range: 16 }
  },
  { key: 'contact_id', name: 'Contact ID', format: 'string', hints: { range: 17 } }
];

export default function GroundStationMetadataProvider() {}

GroundStationMetadataProvider.prototype.supportsMetadata = function (domainObject) {
  return domainObject.type === ANTENNA_TYPE;
};

GroundStationMetadataProvider.prototype.getMetadata = function (domainObject) {
  return Object.assign({}, domainObject.telemetry, { values: VALUES });
};
