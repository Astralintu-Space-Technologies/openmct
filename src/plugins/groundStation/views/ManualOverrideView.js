import mount from 'utils/mount';

import { OVERRIDE_TYPE } from '../types.js';
import ManualOverride from './components/ManualOverride.vue';

export default function ManualOverrideViewProvider(openmct) {
  return {
    key: 'groundStation.manualOverride',
    name: 'Manual Override',
    cssClass: 'icon-command',
    canView(domainObject) {
      return domainObject.type === OVERRIDE_TYPE;
    },
    view(domainObject) {
      let _destroy = null;

      return {
        show(element) {
          const { destroy } = mount(
            {
              el: element,
              components: { ManualOverride },
              provide: { openmct, domainObject },
              template: '<manual-override></manual-override>'
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
