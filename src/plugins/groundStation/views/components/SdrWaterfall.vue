<template>
  <div class="gs-waterfall">
    <div class="gs-waterfall__row gs-waterfall__row--main">
      <canvas ref="waterfallCanvas" class="gs-waterfall__canvas"></canvas>
    </div>
    <div class="gs-waterfall__row gs-waterfall__row--plots">
      <div class="gs-waterfall__spectrum-wrap">
        <canvas ref="spectrumCanvas" class="gs-waterfall__spectrum"></canvas>
      </div>
      <div class="gs-waterfall__constellation-wrap">
        <canvas ref="constellationCanvas" class="gs-waterfall__constellation"></canvas>
      </div>
    </div>
    <div class="gs-waterfall__status">{{ statusText }}</div>
    <div v-if="!wsUrl" class="gs-waterfall__hint">
      Set "Waterfall WebSocket URL" on this object (e.g. ws://localhost:8765) to enable the
      waterfall/spectrum/constellation views. Run scripts/zmq-ws-bridge.py pointed at your GNU Radio
      ZMQ PUB sink to provide it.
    </div>
  </div>
</template>

<script>
// Wire protocol (scripts/zmq-ws-bridge.py), one binary frame per emitted sample block:
// [8B BE float64 unix epoch seconds]
// [4B BE u32 fftLen][fftLen float32 power-dB bins]
// [4B BE u32 iqLen][iqLen float32, interleaved I,Q pairs]
// The timestamp is a fixed 8 bytes, not a length-prefixed string, so every
// later Float32Array's byteOffset stays a multiple of 4 — see
// zmq-ws-bridge.py's docstring for why that matters.
const DB_MIN = -140;
const DB_MAX = 10;
const ROW_HEIGHT = 1;
const DEFAULT_CONSTELLATION_SIZE = 512;
// how fast the auto-scale for the constellation plot backs off after a peak,
// so the scale doesn't visibly jump on every single frame
const CONSTELLATION_SCALE_DECAY = 0.98;

export default {
  inject: ['domainObject'],
  data() {
    return {
      statusText: 'Not connected',
      ws: null,
      constellationMaxMag: 1
    };
  },
  computed: {
    config() {
      return this.domainObject.configuration || {};
    },
    wsUrl() {
      return this.config.waterfallWsUrl;
    }
  },
  mounted() {
    if (this.wsUrl) {
      this.connect();
    }
  },
  beforeUnmount() {
    if (this.ws) {
      this.ws.close();
    }
  },
  methods: {
    connect() {
      this.statusText = 'Connecting…';
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.statusText = 'Connected';
        this.ws.send(
          JSON.stringify({
            type: 'subscribe',
            zmq_address: this.config.zmqAddress,
            frequency: this.config.frequency,
            sample_rate: this.config.sampleRate,
            fft_size: this.config.fftSize,
            constellation_size: this.config.constellationSize || DEFAULT_CONSTELLATION_SIZE
          })
        );
      };

      this.ws.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) {
          // config/status JSON frames sent on connect — nothing to render
          return;
        }
        this.renderFrame(event.data);
      };

      this.ws.onerror = () => {
        this.statusText = 'Connection error';
      };

      this.ws.onclose = () => {
        this.statusText = 'Disconnected';
      };
    },
    renderFrame(buffer) {
      const view = new DataView(buffer);
      let offset = 8; // fixed-size timestamp (float64), not currently rendered

      const fftLen = view.getUint32(offset, false);
      offset += 4;
      const fftBins = new Float32Array(buffer, offset, fftLen / 4);
      offset += fftLen;

      const iqLen = view.getUint32(offset, false);
      offset += 4;
      const iqPairs = new Float32Array(buffer, offset, iqLen / 4);

      this.drawWaterfallRow(fftBins);
      this.drawSpectrum(fftBins);
      this.drawConstellation(iqPairs);
    },
    drawWaterfallRow(bins) {
      const canvas = this.$refs.waterfallCanvas;
      if (!canvas) {
        return;
      }

      const width = canvas.clientWidth || bins.length;
      if (canvas.width !== width) {
        canvas.width = width;
      }
      if (canvas.height < 1) {
        canvas.height = canvas.clientHeight || 220;
      }

      const ctx = canvas.getContext('2d');
      // Scroll via a self-blit (GPU-composited) instead of
      // getImageData/putImageData (a full-canvas JS-visible pixel array
      // round-trip) — getImageData/putImageData every frame was the main
      // cost in the waterfall render, separate from the bridge-side fix.
      ctx.drawImage(
        canvas,
        0,
        0,
        canvas.width,
        canvas.height - ROW_HEIGHT,
        0,
        ROW_HEIGHT,
        canvas.width,
        canvas.height - ROW_HEIGHT
      );

      const row = ctx.createImageData(canvas.width, ROW_HEIGHT);
      for (let x = 0; x < canvas.width; x++) {
        const binIndex = Math.floor((x / canvas.width) * bins.length);
        const pct = Math.max(0, Math.min(1, (bins[binIndex] - DB_MIN) / (DB_MAX - DB_MIN)));
        const [r, g, b] = this.colormap(pct);
        const i = x * 4;
        row.data[i] = r;
        row.data[i + 1] = g;
        row.data[i + 2] = b;
        row.data[i + 3] = 255;
      }
      ctx.putImageData(row, 0, 0);
    },
    drawSpectrum(bins) {
      const canvas = this.$refs.spectrumCanvas;
      if (!canvas) {
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width) {
        canvas.width = width;
      }
      if (canvas.height !== height) {
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const binIndex = Math.floor((x / width) * bins.length);
        const pct = Math.max(0, Math.min(1, (bins[binIndex] - DB_MIN) / (DB_MAX - DB_MIN)));
        const y = height - pct * height;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    },
    drawConstellation(iqPairs) {
      const canvas = this.$refs.constellationCanvas;
      if (!canvas) {
        return;
      }

      const size = Math.min(canvas.clientWidth, canvas.clientHeight);
      if (canvas.width !== size) {
        canvas.width = size;
      }
      if (canvas.height !== size) {
        canvas.height = size;
      }

      let peak = 0;
      for (let i = 0; i < iqPairs.length; i += 2) {
        const mag = Math.hypot(iqPairs[i], iqPairs[i + 1]);
        if (mag > peak) {
          peak = mag;
        }
      }
      // rises immediately to a new peak, decays slowly otherwise — avoids
      // rescaling (and the plot visibly "breathing") on every single frame
      this.constellationMaxMag = Math.max(
        peak,
        this.constellationMaxMag * CONSTELLATION_SCALE_DECAY
      );
      const scale = size / 2 / 1.3 / (this.constellationMaxMag || 1);

      const ctx = canvas.getContext('2d');
      // translucent fill (not clearRect) gives old points a fading trail,
      // like a real oscilloscope, rather than a hard cut between frames
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(size / 2, 0);
      ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2);
      ctx.lineTo(size, size / 2);
      ctx.stroke();

      ctx.fillStyle = '#66bb6a';
      for (let i = 0; i < iqPairs.length; i += 2) {
        const x = size / 2 + iqPairs[i] * scale;
        const y = size / 2 - iqPairs[i + 1] * scale;
        ctx.fillRect(x, y, 2, 2);
      }
    },
    colormap(pct) {
      // simple blue -> green -> yellow -> red ramp, not a perceptual colormap
      const r = Math.round(255 * Math.min(1, pct * 2));
      const g = Math.round(255 * Math.min(1, Math.max(0, 1 - Math.abs(pct - 0.5) * 2)));
      const b = Math.round(255 * Math.min(1, (1 - pct) * 2));
      return [r, g, b];
    }
  }
};
</script>
