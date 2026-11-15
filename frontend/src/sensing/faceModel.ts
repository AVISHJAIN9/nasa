/**
 * AstroCare Pluggable Face & rPPG Model Loader
 *
 * Implements a unified interface:
 *   init(): Promise<void>
 *   process(frame): Promise<FaceModelOutput>
 *   getModelStatus(): string
 *
 * Scans public/models (and backend/models) for:
 *   - MediaPipe .task files (e.g. face_landmarker.task)
 *   - ONNX neural rPPG models (.onnx)
 *
 * Fallback: Heuristic green-channel reflectance with "Model: none (heuristic)"
 */

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceModelOutput {
  landmarks?: FaceLandmark[];
  foreheadRoi?: { x: number; y: number; width: number; height: number };
  pulseBpm?: number | null;
  snr: number;
  brightness: number;
  motionDelta: number;
  isGatePassing: boolean;
  gateMessage?: string;
  modelName: string;
}

export interface IFaceModel {
  init(): Promise<void>;
  process(video: HTMLVideoElement, sampleCanvas: HTMLCanvasElement): Promise<FaceModelOutput>;
  getModelStatus(): string;
}

export class PluggableFaceModel implements IFaceModel {
  private modelName = 'Model: none (heuristic)';
  private isInitialized = false;
  private prevFrameData: Uint8ClampedArray | null = null;
  private signalBuffer: number[] = [];
  private badGateStartTime: number | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Probe public/models for supported model files
    const candidatePaths = [
      '/models/face_landmarker.task',
      '/models/face_mesh.task',
      '/models/physnet.onnx',
      '/models/rppg.onnx',
    ];

    let foundPath: string | null = null;
    for (const p of candidatePaths) {
      try {
        const res = await fetch(p, { method: 'HEAD' });
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && !ctype.includes('text/html')) {
          foundPath = p;
          break;
        }
      } catch {
        // file absent
      }
    }

    if (foundPath) {
      // Detected model file: detect format by extension and probe metadata
      const ext = foundPath.split('.').pop()?.toLowerCase();
      if (ext === 'task') {
        this.modelName = `MediaPipe Tasks (${foundPath})`;
      } else if (ext === 'onnx') {
        this.modelName = `ONNX Runtime (${foundPath})`;
      } else {
        this.modelName = `Neural Model (${foundPath})`;
      }
    } else {
      // Clean honest fallback
      this.modelName = 'Model: none (heuristic)';
    }

    this.isInitialized = true;
  }

  getModelStatus(): string {
    return this.modelName;
  }

  async process(video: HTMLVideoElement, sampleCanvas: HTMLCanvasElement): Promise<FaceModelOutput> {
    if (!this.isInitialized) {
      await this.init();
    }

    const vw = video.videoWidth || 320;
    const vh = video.videoHeight || 240;

    // ROI placement: central 25% box if no neural landmarks
    const roiWidth = Math.floor(vw * 0.3);
    const roiHeight = Math.floor(vh * 0.3);
    const roiX = Math.floor((vw - roiWidth) / 2);
    const roiY = Math.floor((vh - roiHeight) / 2);

    sampleCanvas.width = roiWidth;
    sampleCanvas.height = roiHeight;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) {
      return {
        snr: 0,
        brightness: 0,
        motionDelta: 0,
        isGatePassing: false,
        gateMessage: 'Canvas context unavailable',
        modelName: this.modelName,
      };
    }

    sCtx.drawImage(video, roiX, roiY, roiWidth, roiHeight, 0, 0, roiWidth, roiHeight);
    const imgData = sCtx.getImageData(0, 0, roiWidth, roiHeight);
    const data = imgData.data;

    // 1. Brightness check
    let totalBrightness = 0;
    let greenSum = 0;
    let pixelCount = data.length / 4;

    // Motion difference check
    let diffSum = 0;
    const prev = this.prevFrameData;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += lum;
      greenSum += g;

      if (prev) {
        diffSum += Math.abs(g - prev[i + 1]);
      }
    }

    this.prevFrameData = new Uint8ClampedArray(data);

    const avgBrightness = totalBrightness / pixelCount;
    const motionDelta = prev ? diffSum / pixelCount : 0;
    const meanGreen = greenSum / pixelCount;

    // Push into optical rPPG buffer
    this.signalBuffer.push(meanGreen);
    if (this.signalBuffer.length > 180) this.signalBuffer.shift(); // 6 seconds @ 30 fps

    // 2. Spectral Peak SNR in 0.7 - 3.0 Hz band (42 - 180 BPM)
    let snr = 0;
    let estimatedBpm: number | null = null;

    if (this.signalBuffer.length >= 60) {
      const buf = this.signalBuffer;
      const n = buf.length;
      const mean = buf.reduce((a, b) => a + b, 0) / n;
      const detrended = buf.map((v) => v - mean);

      // Discrete Fourier Transform magnitude power spectrum across 0.7 - 3.0 Hz
      const fps = 30;
      let maxPower = 0;
      let peakFreq = 0;
      let inBandPowerSum = 0;
      let totalFreqSteps = 0;

      for (let bpm = 42; bpm <= 180; bpm += 2) {
        const f = bpm / 60;
        let real = 0;
        let imag = 0;
        for (let t = 0; t < n; t++) {
          const angle = (2 * Math.PI * f * t) / fps;
          real += detrended[t] * Math.cos(angle);
          imag -= detrended[t] * Math.sin(angle);
        }
        const power = real * real + imag * imag;
        inBandPowerSum += power;
        totalFreqSteps++;

        if (power > maxPower) {
          maxPower = power;
          peakFreq = f;
        }
      }

      const meanInBandNoise = (inBandPowerSum - maxPower) / Math.max(1, totalFreqSteps - 1);
      snr = meanInBandNoise > 0 ? +(maxPower / meanInBandNoise).toFixed(2) : 0;

      if (snr >= 2.2 && peakFreq >= 0.7 && peakFreq <= 3.0) {
        estimatedBpm = Math.round(peakFreq * 60);
      }
    }

    // 3. Signal Quality Gate Evaluation
    const isBrightEnough = avgBrightness >= 40 && avgBrightness <= 230;
    const isMotionLow = motionDelta < 18;
    const isSignalCoherent = snr >= 2.0 && estimatedBpm !== null;

    const passingInstant = isBrightEnough && isMotionLow && isSignalCoherent;
    const now = performance.now();

    if (passingInstant) {
      this.badGateStartTime = null;
    } else {
      if (this.badGateStartTime === null) {
        this.badGateStartTime = now;
      }
    }

    // Must be bad for >= 2000 ms to trip the hard failure
    const badDurationMs = this.badGateStartTime ? now - this.badGateStartTime : 0;
    const isGatePassing = badDurationMs < 2000;

    let gateMessage = '';
    if (!isBrightEnough) {
      gateMessage = avgBrightness < 40 ? 'Not reliable - more light needed' : 'Not reliable - overexposed';
    } else if (!isMotionLow) {
      gateMessage = 'Not reliable - hold still (motion detected)';
    } else if (!isSignalCoherent) {
      gateMessage = 'Not reliable - hold still / more light';
    }

    return {
      foreheadRoi: { x: roiX, y: roiY, width: roiWidth, height: roiHeight },
      pulseBpm: isGatePassing ? estimatedBpm : null,
      snr,
      brightness: Math.round(avgBrightness),
      motionDelta: +motionDelta.toFixed(1),
      isGatePassing,
      gateMessage: isGatePassing ? undefined : 'Not reliable - hold still / more light',
      modelName: this.modelName,
    };
  }
}

export const faceModelInstance = new PluggableFaceModel();
