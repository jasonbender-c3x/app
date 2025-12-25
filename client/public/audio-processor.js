class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Match the buffer size from the original ScriptProcessor (4096)
    // to maintain consistent chunk sizes for the backend
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    
    const channelData = input[0];
    
    // AudioWorklet processes 128 frames at a time.
    // We buffer them to create larger chunks for network transmission.
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];
      
      if (this.bufferIndex >= this.bufferSize) {
        this.flush();
      }
    }
    
    return true;
  }

  flush() {
    // Convert Float32 to Int16 PCM
    const pcmData = new Int16Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Send the ArrayBuffer to the main thread
    // We transfer the buffer to avoid copying
    this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
    
    this.bufferIndex = 0;
  }
}

registerProcessor('audio-processor', AudioProcessor);
