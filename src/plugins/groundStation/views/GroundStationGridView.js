import mount from 'utils/mount';

import { DASHBOARD_TYPE } from '../types.js';
import GroundStationGrid from './components/GroundStationGrid.vue';

export default function GroundStationGridViewProvider(openmct) {
  return {
    key: 'groundStation.grid',
    name: 'Grid',
    cssClass: 'icon-grid',
    canView(domainObject) {
      return domainObject.type === DASHBOARD_TYPE;
    },
    view(domainObject) {
      let _destroy = null;

      return {
        show(element) {
          const { destroy } = mount(
            {
              el: element,
              components: { GroundStationGrid },
              provide: { openmct, domainObject },
              template: '<ground-station-grid></ground-station-grid>'
            },
            { app: openmct.app, element }
          );
          _destroy = destroy;
        },
        destroy() {
          if (_destroy) {
            _destroy();
          }
        }
      };
    }
  };
}
