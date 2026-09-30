// The live-caption audio tap: an AudioWorklet that hands the microphone's
// samples to the main thread in fixed blocks.
//
// Loaded by app/lib/voice/capture/pcmTap.ts with
// `audioWorklet.addModule("/worklets/pcm-capture.worklet.js")`. It lives in
// public/ because a worklet is fetched by URL into its own global scope; the
// bundler never sees it, so it is plain JavaScript with no imports.
//
// It does as little as possible on the audio thread. Resampling to 16 kHz and
// cutting 100 ms frames happen on the main thread (pcmFrames.ts), where the
// code can be tested and a slow moment costs a late caption rather than a
// glitch in the audio graph.
//
// Blocks are ~50 ms at the context's rate. The render quantum (128 samples,
// about 2.7 ms) would mean ~370 messages a second; 50 ms is 20.
//
// A render quantum with no input channels (the track is muted, ended, or not
// yet flowing) is copied as silence, not skipped: the stream's clock counts
// samples, and AWS asks for silence rather than gaps.
//
// Messages out: { type: "block", samples: Float32Array, frame: number }, where
// `frame` is the context frame of the block's first sample. The sample buffer
// is transferred, not copied.
// Messages in: { type: "stop" } posts the part-filled block and ends processing.

/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentFrame */

const BLOCK_SECONDS = 0.05;
const QUANTUM = 128;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const requested = options && options.processorOptions ? options.processorOptions.blockSamples : undefined;
    this.blockSamples = Number.isInteger(requested) && requested > 0 ? requested : Math.max(1, Math.round(sampleRate * BLOCK_SECONDS));
    this.block = new Float32Array(this.blockSamples);
    this.filled = 0;
    this.blockFrame = 0;
    this.running = true;
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === "stop") {
        this.post();
        this.running = false;
      }
    };
  }

  post() {
    if (this.filled === 0) return;
    const samples = this.filled === this.blockSamples ? this.block : this.block.slice(0, this.filled);
    this.port.postMessage({ type: "block", samples, frame: this.blockFrame }, [samples.buffer]);
    this.block = new Float32Array(this.blockSamples);
    this.filled = 0;
  }

  process(inputs, outputs) {
    if (!this.running) return false;
    const input = inputs[0] || [];
    const channels = input.length;
    const output = outputs[0] && outputs[0][0];
    const length = channels > 0 ? input[0].length : output ? output.length : QUANTUM;

    for (let i = 0; i < length; i++) {
      if (this.filled === 0) this.blockFrame = currentFrame + i;
      let value = 0;
      if (channels === 1) {
        value = input[0][i];
      } else if (channels > 1) {
        // The node asks for one channel, so the graph already mixes down; this
        // covers an engine that hands over the source's layout anyway.
        for (let c = 0; c < channels; c++) value += input[c][i];
        value /= channels;
      }
      this.block[this.filled++] = value;
      if (this.filled === this.blockSamples) this.post();
    }
    // The output stays silent. It exists so the node sits on a path to the
    // destination, which is what guarantees the engine keeps calling process().
    return true;
  }
}

registerProcessor("rww-pcm-capture", PcmCaptureProcessor);
