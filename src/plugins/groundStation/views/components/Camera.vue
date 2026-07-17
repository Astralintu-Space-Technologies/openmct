<template>
  <div class="gs-camera">
    <img
      v-if="streamUrl && streamType === 'mjpeg'"
      :src="streamUrl"
      class="gs-camera__video"
      alt="Camera feed"
    />
    <template v-else-if="streamUrl">
      <video ref="video" class="gs-camera__video" autoplay muted playsinline controls></video>
      <div v-if="playerError" class="gs-camera__error">{{ playerError }}</div>
    </template>
    <div v-else class="gs-camera-placeholder">
      <div class="gs-camera-placeholder__icon">📷</div>
      <p>No camera feed is configured for this ground station yet.</p>
      <p class="gs-camera-placeholder__hint">
        Set "Stream URL" on this object — an HLS <code>.m3u8</code> URL (e.g. from a MediaMTX/
        go2rtc bridge transcoding an RTSP camera) with "Stream Type" = HLS, or a raw MJPEG URL with
        "Stream Type" = MJPEG.
      </p>
    </div>
  </div>
</template>

<script>
import Hls from 'hls.js';

export default {
  name: 'GroundStationCamera',
  inject: ['domainObject'],
  data() {
    return {
      hls: null,
      playerError: ''
    };
  },
  computed: {
    config() {
      return this.domainObject.configuration || {};
    },
    streamUrl() {
      return this.config.streamUrl;
    },
    streamType() {
      return this.config.streamType || 'hls';
    }
  },
  mounted() {
    if (this.streamUrl && this.streamType === 'hls') {
      this.setupHls();
    }
  },
  beforeUnmount() {
    if (this.hls) {
      this.hls.destroy();
    }
  },
  methods: {
    setupHls() {
      const video = this.$refs.video;
      if (!video) {
        return;
      }

      // Safari has native HLS support and does worse with hls.js attached on top of it
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = this.streamUrl;
        return;
      }

      if (!Hls.isSupported()) {
        this.playerError = 'HLS playback is not supported in this browser.';
        return;
      }

      this.hls = new Hls();
      this.hls.loadSource(this.streamUrl);
      this.hls.attachMedia(video);
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          this.playerError = `HLS error (${data.type}): ${data.details}`;
        }
      });
    }
  }
};
</script>
