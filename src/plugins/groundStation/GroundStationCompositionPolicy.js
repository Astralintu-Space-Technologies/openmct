import {
  ANTENNA_TYPE,
  CAMERA_TYPE,
  CONTACTS_TYPE,
  DASHBOARD_TYPE,
  OVERRIDE_TYPE,
  SDR_TYPE,
  WEATHER_TYPE
} from './types.js';

const ALLOWED_CHILD_TYPES = [
  ANTENNA_TYPE,
  SDR_TYPE,
  OVERRIDE_TYPE,
  CAMERA_TYPE,
  CONTACTS_TYPE,
  WEATHER_TYPE
];

/**
 * Keeps a Ground Station Dashboard's composition to the panel types its Grid
 * view actually knows how to render, mirroring GaugeCompositionPolicy's
 * pattern (src/plugins/gauge/GaugeCompositionPolicy.js).
 */
export default function GroundStationCompositionPolicy() {
  return {
    allow(parent, child) {
      if (parent.type === DASHBOARD_TYPE) {
        return ALLOWED_CHILD_TYPES.includes(child.type);
      }
      return true;
    }
  };
}
