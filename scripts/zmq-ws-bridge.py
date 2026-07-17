"""
zmq-ws-bridge.py

Bridges a GNU Radio "ZMQ PUB Sink" block (raw complex64 IQ samples, no
framing beyond ZMQ's own message boundaries) to a browser-facing WebSocket
for the OpenMCT Ground Station SDR panel. Browsers can't open a raw ZMQ
socket directly, so this always has to sit in between.

Per connected client, computes from the same rolling sample buffer:
  - an FFT (for the waterfall/spectrum views)
  - a decimated raw-IQ tail (for the constellation view)
and sends both in one binary frame, at a fixed throttled rate independent of
however fast GNU Radio is actually producing samples.

Multiple browser tabs subscribing to the same zmq_address share one ZMQ SUB
socket/buffer (see SampleSource) rather than each opening their own
subscription to the flowgraph.

Run: python3 zmq-ws-bridge.py [--ws-host 0.0.0.0] [--ws-port 8765]

Wire protocol
-------------
Client -> bridge, JSON text frame on connect (and whenever settings change):
    {
      "type": "subscribe",
      "zmq_address": "tcp://127.0.0.1:55004",
      "frequency": 437000000,
      "sample_rate": 250000,
      "fft_size": 1024,
      "constellation_size": 512
    }

Bridge -> client:
  - JSON text frames: {"type": "config", ...} and {"type": "status", ...},
    sent once right after a subscribe is processed (informational only).
  - Then a continuous stream of binary frames, each:
      [8B big-endian float64 unix epoch seconds]
      [4B big-endian uint32 fftLen][fftLen bytes float32 power-dB bins]
      [4B big-endian uint32 iqLen][iqLen bytes float32, interleaved I,Q pairs]
    The timestamp is a fixed 8 bytes rather than a length-prefixed string
    deliberately: JS's Float32Array constructor requires its byteOffset into
    the buffer to be a multiple of 4, and a variable-length string before the
    FFT section would only sometimes land on a 4-byte boundary — a fixed 8B
    field (plus fftLen/iqLen always being multiples of 4, since they're byte
    lengths of float32 arrays) keeps every subsequent offset 4-byte-aligned.
    See openmct's SdrWaterfall.vue for the matching parser.
"""

import argparse
import asyncio
import json
import logging
import struct
import time

import numpy as np
import websockets
import zmq
import zmq.asyncio

logger = logging.getLogger("zmq-ws-bridge")

DEFAULT_FFT_SIZE = 1024
DEFAULT_CONSTELLATION_SIZE = 512
EMIT_INTERVAL_SECS = 1 / 30  # throttle emitted frames to ~30fps regardless of ZMQ rate
DB_MIN = -140.0
DB_MAX = 10.0


class SampleSource:
    """One ZMQ SUB socket + rolling buffer of the most recent raw complex
    samples for a given zmq_address, shared across every client subscribed
    to that same address.

    Uses a true circular buffer: each incoming ZMQ message is written in
    O(message_len), not O(buffer_len). The earlier version rebuilt the whole
    buffer with np.concatenate on *every* incoming message — cheap-looking,
    but GNU Radio can emit hundreds of small messages per second, so that
    O(buffer_len) copy ran at message rate, not frame rate, and was the
    actual cause of the bridge falling behind on constrained hardware (e.g.
    a Raspberry Pi). Reassembling into linear (oldest-to-newest) order now
    only happens in snapshot(), which the emit loop calls at a fixed ~30fps
    regardless of how fast the source produces samples.
    """

    def __init__(self, zmq_context, zmq_address, buffer_len):
        self.zmq_address = zmq_address
        self.buffer_len = buffer_len
        self._socket = zmq_context.socket(zmq.SUB)
        self._socket.connect(zmq_address)
        self._socket.setsockopt_string(zmq.SUBSCRIBE, "")
        self._buffer = np.zeros(buffer_len, dtype=np.complex64)
        self._write_pos = 0
        self._wrapped = False
        self._task = None
        self._refcount = 0

    async def _run(self):
        while True:
            msg = await self._socket.recv()
            samples = np.frombuffer(msg, dtype=np.complex64)
            n = len(samples)
            if n <= 0:
                continue

            if n >= self.buffer_len:
                self._buffer[:] = samples[-self.buffer_len :]
                self._write_pos = 0
                self._wrapped = True
                continue

            end = self._write_pos + n
            if end <= self.buffer_len:
                self._buffer[self._write_pos : end] = samples
            else:
                first_part = self.buffer_len - self._write_pos
                self._buffer[self._write_pos :] = samples[:first_part]
                self._buffer[: end - self.buffer_len] = samples[first_part:]
                self._wrapped = True
            self._write_pos = end % self.buffer_len

    def acquire(self):
        self._refcount += 1
        if self._task is None:
            self._task = asyncio.ensure_future(self._run())

    def release(self):
        self._refcount -= 1
        if self._refcount <= 0 and self._task is not None:
            self._task.cancel()
            self._task = None
            self._socket.close()

    def snapshot(self):
        if not self._wrapped:
            # Startup transient only: buffer not full yet, current contents
            # (zero-padded tail) are already in oldest-to-newest order.
            return self._buffer.copy()
        # Oldest sample is at _write_pos (about to be overwritten next),
        # newest just before it — reorder into a plain linear array.
        return np.concatenate([self._buffer[self._write_pos :], self._buffer[: self._write_pos]])


_sources = {}


def get_source(zmq_context, zmq_address, buffer_len):
    key = (zmq_address, buffer_len)
    source = _sources.get(key)
    if source is None:
        source = SampleSource(zmq_context, zmq_address, buffer_len)
        _sources[key] = source
    return source


_window_cache = {}


def get_window(fft_size):
    # np.blackman(fft_size) is the same array every time for a given
    # fft_size — recomputing it on every emitted frame (~30/sec) was wasted
    # CPU for no benefit.
    window = _window_cache.get(fft_size)
    if window is None:
        window = np.blackman(fft_size)
        _window_cache[fft_size] = window
    return window


def compute_fft_db(samples, fft_size):
    windowed = samples[-fft_size:] * get_window(fft_size)
    spectrum = np.fft.fftshift(np.fft.fft(windowed))
    power_db = 20 * np.log10(np.abs(spectrum) + 1e-10)
    return np.clip(power_db, DB_MIN, DB_MAX).astype(np.float32)


def build_frame(samples, fft_size, constellation_size):
    # Fixed 8B float64, not a length-prefixed string — see module docstring
    # for why (JS Float32Array alignment).
    ts_bytes = struct.pack(">d", time.time())

    fft_bytes = compute_fft_db(samples, fft_size).tobytes()

    iq_tail = samples[-constellation_size:]
    interleaved = np.empty(len(iq_tail) * 2, dtype=np.float32)
    interleaved[0::2] = iq_tail.real
    interleaved[1::2] = iq_tail.imag
    iq_bytes = interleaved.tobytes()

    return (
        ts_bytes
        + struct.pack(">I", len(fft_bytes))
        + fft_bytes
        + struct.pack(">I", len(iq_bytes))
        + iq_bytes
    )


async def emit_loop(websocket, state):
    while True:
        source = state.get("source")
        if source is not None:
            frame = build_frame(
                source.snapshot(), state["fft_size"], state["constellation_size"]
            )
            await websocket.send(frame)
        await asyncio.sleep(EMIT_INTERVAL_SECS)


async def handle_client(websocket):
    zmq_context = zmq.asyncio.Context.instance()
    state = {
        "source": None,
        "fft_size": DEFAULT_FFT_SIZE,
        "constellation_size": DEFAULT_CONSTELLATION_SIZE,
    }
    emitter = None

    try:
        async for raw_message in websocket:
            try:
                message = json.loads(raw_message)
            except (TypeError, ValueError):
                continue

            if message.get("type") != "subscribe":
                continue

            zmq_address = message.get("zmq_address")
            if not zmq_address:
                logger.warning("subscribe message missing zmq_address, ignoring: %s", message)
                continue

            fft_size = int(message.get("fft_size") or DEFAULT_FFT_SIZE)
            constellation_size = int(
                message.get("constellation_size") or DEFAULT_CONSTELLATION_SIZE
            )
            buffer_len = max(fft_size, constellation_size) * 4

            if state["source"] is not None:
                state["source"].release()

            state["source"] = get_source(zmq_context, zmq_address, buffer_len)
            state["source"].acquire()
            state["fft_size"] = fft_size
            state["constellation_size"] = constellation_size

            await websocket.send(
                json.dumps(
                    {
                        "type": "config",
                        "fft_size": fft_size,
                        "constellation_size": constellation_size,
                        "sample_rate": message.get("sample_rate"),
                        "center_frequency": message.get("frequency"),
                        "zmq_address": zmq_address,
                    }
                )
            )
            await websocket.send(
                json.dumps({"type": "status", "message": "Connected to ZMQ bridge"})
            )

            if emitter is None:
                emitter = asyncio.ensure_future(emit_loop(websocket, state))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if emitter is not None:
            emitter.cancel()
        if state["source"] is not None:
            state["source"].release()


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ws-host", default="0.0.0.0")
    parser.add_argument("--ws-port", type=int, default=8765)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    logger.info("listening on ws://%s:%s", args.ws_host, args.ws_port)

    async with websockets.serve(handle_client, args.ws_host, args.ws_port):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
