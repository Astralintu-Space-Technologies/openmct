import { ANTENNA_TYPE } from './types.js';

// Thresholds are deliberately conservative starting points, not calibrated
// link-budget numbers for any specific antenna/modem — adjust to match your
// actual RF chain.
const THRESHOLDS = {
  snr: { red: 3, yellow: 8 }, // dB, lower is worse
  rssi: { red: -95, yellow: -85 }, // dBm, more negative is worse
  link_margin_db: { red: 0, yellow: 3 } // dB, lower is worse
};

const LIMITS = {
  red: { cssClass: 'is-limit--red is-limit--lwr', name: 'Red Low' },
  yellow: { cssClass: 'is-limit--yellow is-limit--lwr', name: 'Yellow Low' }
};

function classify(key, value) {
  const threshold = THRESHOLDS[key];
  if (!threshold || value === undefined || value === null || Number.isNaN(value)) {
    return undefined;
  }

  if (value <= threshold.red) {
    return LIMITS.red;
  }

  if (value <= threshold.yellow) {
    return LIMITS.yellow;
  }

  return undefined;
}

export default function GroundStationLimitProvider() {}

GroundStationLimitProvider.prototype.supportsLimits = function (domainObject) {
  return domainObject.type === ANTENNA_TYPE;
};

GroundStationLimitProvider.prototype.getLimitEvaluator = function () {
  return {
    evaluate(datum, valueMetadata) {
      const key = valueMetadata && valueMetadata.key;
      return classify(key, datum[key]);
    }
  };
};
