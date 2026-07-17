import mount from 'utils/mount';

import { CONTACTS_TYPE } from '../types.js';
import Contacts from './components/Contacts.vue';

export default function ContactsViewProvider(openmct) {
  return {
    key: 'groundStation.contacts',
    name: 'Contacts',
    cssClass: 'icon-tabular',
    canView(domainObject) {
      return domainObject.type === CONTACTS_TYPE;
    },
    view(domainObject) {
      let _destroy = null;

      return {
        show(element) {
          const { destroy } = mount(
            {
              el: element,
              components: { Contacts },
              provide: { openmct, domainObject },
              template: '<contacts></contacts>'
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
