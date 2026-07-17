import mount from 'utils/mount';

import { ANTENNA_TYPE } from '../types.js';
import PassProgress from './components/PassProgress.vue';

export default function PassProgressViewProvider(openmct) {
  return {
    key: 'groundStation.passProgress',
    name: 'Pass Progress',
    cssClass: 'icon-timer',
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
              components: { PassProgress },
              provide: { openmct, domainObject },
              template: '<pass-progress></pass-progress>'
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
