import { LiveServerMessage } from "@google/genai";

export class LiveAudioSystem {
  private audioContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  private nextPlayTime: number = 0;
  
  private onData: (base64Data: string) => void;
  
  constructor(onData: (base64Data: string) => void) {
    this.onData = onData;
  }
  
  async startMicrophone() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Web Audio API requires sampleRate 16000 for input to Gemini Live
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    this.playbackContext = new AudioContext({ sampleRate: 24000 });
    await this.playbackContext.resume();
    this.nextPlayTime = this.playbackContext.currentTime;

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        let hasAudio = false;
        for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            if (pcm16[i] !== 0) hasAudio = true;
        }
        
        if (!hasAudio) return; // don't send complete silence

        const buffer = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < buffer.byteLength; i++) {
            binary += String.fromCharCode(buffer[i]);
        }
        this.onData(btoa(binary));
    };
    
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }
  
  stopMicrophone() {
    if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
    }
    if (this.source) {
        this.source.disconnect();
        this.source = null;
    }
    if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
    }
    if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
    }
    if (this.playbackContext) {
        this.playbackContext.close();
        this.playbackContext = null;
    }
  }
  
  playAudioBase64(base64: string) {
    if (!this.playbackContext) {
        this.playbackContext = new AudioContext({ sampleRate: 24000 });
        this.nextPlayTime = this.playbackContext.currentTime;
    }
    
    if (this.playbackContext.state === 'suspended') {
       this.playbackContext.resume();
    }
    
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    
    const view = new DataView(array.buffer);
    const length = array.length / 2;
    const audioBuffer = this.playbackContext.createBuffer(1, length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
        channelData[i] = view.getInt16(i * 2, true) / 32768; // little-endian
    }
    
    const source = this.playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackContext.destination);
    
    let playAt = Math.max(this.playbackContext.currentTime, this.nextPlayTime);
    source.start(playAt);
    this.nextPlayTime = playAt + audioBuffer.duration;
  }
  
  interrupt() {
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
      this.nextPlayTime = 0;
    }
  }
}
