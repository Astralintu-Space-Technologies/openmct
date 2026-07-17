import mount from 'utils/mount';

import { WEATHER_TYPE } from '../types.js';
import Weather from './components/Weather.vue';

export default function WeatherViewProvider(openmct) {
  return {
    key: 'groundStation.weather',
    name: 'Weather',
    cssClass: 'icon-brightness',
    canView(domainObject) {
      return domainObject.type === WEATHER_TYPE;
    },
    view(domainObject) {
      let _destroy = null;

      return {
        show(element) {
          const { destroy } = mount(
            {
              el: element,
              components: { Weather },
              provide: { openmct, domainObject },
              template: '<weather></weather>'
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
