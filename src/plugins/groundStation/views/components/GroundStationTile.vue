<template>
  <div class="gs-tile" :class="`gs-tile--${sizeClass}`">
    <div class="gs-tile__header">
      <div class="gs-tile__icon" :class="iconClass"></div>
      <div class="gs-tile__name" :title="child.name">{{ child.name }}</div>
    </div>
    <div class="gs-tile__body">
      <template v-if="child.type === ANTENNA_TYPE">
        <div class="gs-tile__split">
          <AntennaCompass />
          <PassProgress />
        </div>
      </template>
      <SdrWaterfall v-else-if="child.type === SDR_TYPE" />
      <ManualOverride v-else-if="child.type === OVERRIDE_TYPE" />
      <Camera v-else-if="child.type === CAMERA_TYPE" />
      <Contacts v-else-if="child.type === CONTACTS_TYPE" />
      <Weather v-else-if="child.type === WEATHER_TYPE" />
      <div v-else class="gs-tile__unknown">Unsupported object type: {{ child.type }}</div>
    </div>
  </div>
</template>

<script>
import {
  ANTENNA_TYPE,
  CAMERA_TYPE,
  CONTACTS_TYPE,
  OVERRIDE_TYPE,
  SDR_TYPE,
  WEATHER_TYPE
} from '../../types.js';
import AntennaCompass from './AntennaCompass.vue';
import Camera from './Camera.vue';
import Contacts from './Contacts.vue';
import ManualOverride from './ManualOverride.vue';
import PassProgress from './PassProgress.vue';
import SdrWaterfall from './SdrWaterfall.vue';
import Weather from './Weather.vue';

const ICON_BY_TYPE = {
  [ANTENNA_TYPE]: 'icon-target',
  [SDR_TYPE]: 'icon-spectra-telemetry',
  [OVERRIDE_TYPE]: 'icon-command',
  [CAMERA_TYPE]: 'icon-camera',
  [CONTACTS_TYPE]: 'icon-database',
  [WEATHER_TYPE]: 'icon-brightness'
};

// wider/taller tiles for panels that need more room to be readable
const SIZE_BY_TYPE = {
  [ANTENNA_TYPE]: 'wide',
  [SDR_TYPE]: 'wide',
  [OVERRIDE_TYPE]: 'normal',
  [CAMERA_TYPE]: 'normal',
  [CONTACTS_TYPE]: 'wide',
  [WEATHER_TYPE]: 'normal'
};

export default {
  components: {
    AntennaCompass,
    PassProgress,
    SdrWaterfall,
    ManualOverride,
    Camera,
    Contacts,
    Weather
  },
  // Overrides the ambient `domainObject` injection so each embedded panel
  // component (originally built as a single-object view) targets this
  // tile's own child object instead of the dashboard container. `openmct`
  // is not re-provided — it resolves from the grid's own provide further up.
  provide() {
    return {
      domainObject: this.child
    };
  },
  props: {
    child: {
      type: Object,
      required: true
    }
  },
  data() {
    return { ANTENNA_TYPE, SDR_TYPE, OVERRIDE_TYPE, CAMERA_TYPE, CONTACTS_TYPE, WEATHER_TYPE };
  },
  computed: {
    iconClass() {
      return ICON_BY_TYPE[this.child.type] || 'icon-object-unknown';
    },
    sizeClass() {
      return SIZE_BY_TYPE[this.child.type] || 'normal';
    }
  }
};
</script>
