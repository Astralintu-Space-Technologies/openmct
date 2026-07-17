import mount from 'utils/mount';

import { ANTENNA_TYPE } from '../types.js';
import AntennaCompass from './components/AntennaCompass.vue';

export default function AntennaCompassViewProvider(openmct) {
  return {
    key: 'groundStation.antennaCompass',
    name: 'Antenna Compass',
    cssClass: 'icon-target',
    canView(domainObject) {
      return domainObject.type === ANTENNA_TYPE;
    },
    view(domainObject) {
      let _destroy = null;

      return {
        show(element) {
          const { destroy } = mount(
            {
              el: element,
              components: { AntennaCompass },
              provide: { openmct, domainObject },
              template: '<antenna-compass></antenna-compass>'
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
