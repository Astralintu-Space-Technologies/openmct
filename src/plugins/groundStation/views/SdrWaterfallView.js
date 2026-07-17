import mount from 'utils/mount';

import { SDR_TYPE } from '../types.js';
import SdrWaterfall from './components/SdrWaterfall.vue';

export default function SdrWaterfallViewProvider(openmct) {
  return {
    key: 'groundStation.sdrWaterfall',
    name: 'Waterfall',
    cssClass: 'icon-spectra-telemetry',
    canView(domainObject) {
      return domainObject.type === SDR_TYPE;
    },
    view(domainObject) {
      let _destroy = null;

      return {
        show(element) {
          const { destroy } = mount(
            {
              el: element,
              components: { SdrWaterfall },
              provide: { openmct, domainObject },
              template: '<sdr-waterfall></sdr-waterfall>'
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
