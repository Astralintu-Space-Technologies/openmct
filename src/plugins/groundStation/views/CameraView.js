import mount from 'utils/mount';

import { CAMERA_TYPE } from '../types.js';
import Camera from './components/Camera.vue';

export default function CameraViewProvider(openmct) {
  return {
    key: 'groundStation.camera',
    name: 'Camera',
    cssClass: 'icon-camera',
    canView(domainObject) {
      return domainObject.type === CAMERA_TYPE;
    },
    view(domainObject) {
      let _destroy = null;

      return {
        show(element) {
          const { destroy } = mount(
            {
              el: element,
              components: { Camera },
              provide: { openmct, domainObject },
              template: '<camera></camera>'
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
