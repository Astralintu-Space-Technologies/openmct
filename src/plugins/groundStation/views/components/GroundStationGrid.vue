<template>
  <div class="gs-grid">
    <div v-if="children.length === 0" class="gs-grid__empty">
      <div class="gs-grid__empty-icon icon-layout"></div>
      <p>This dashboard is empty.</p>
      <p class="gs-grid__empty-hint">
        Drag Ground Station Antenna / SDR Waterfall / Manual Override / Camera objects from the tree
        into this object to populate the grid.
      </p>
    </div>
    <div v-else class="gs-grid__container">
      <GroundStationTile v-for="child in children" :key="keyString(child)" :child="child" />
    </div>
  </div>
</template>

<script>
import GroundStationTile from './GroundStationTile.vue';

export default {
  components: { GroundStationTile },
  inject: ['openmct', 'domainObject'],
  data() {
    return {
      children: []
    };
  },
  mounted() {
    this.compositionCollection = this.openmct.composition.get(this.domainObject);
    this.compositionCollection.on('add', this.onAdd);
    this.compositionCollection.on('remove', this.onRemove);
    this.compositionCollection.load();
  },
  beforeUnmount() {
    if (this.compositionCollection) {
      this.compositionCollection.off('add', this.onAdd);
      this.compositionCollection.off('remove', this.onRemove);
    }
  },
  methods: {
    onAdd(child) {
      this.children.push(child);
    },
    onRemove(child) {
      const removedKey = this.keyString(child);
      this.children = this.children.filter((existing) => this.keyString(existing) !== removedKey);
    },
    keyString(child) {
      return this.openmct.objects.makeKeyString(child.identifier);
    }
  }
};
</script>
