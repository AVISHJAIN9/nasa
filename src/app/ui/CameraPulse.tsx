import {useEffect, useRef, useState} from 'react';
import {useStore} from '../../store';

export function CameraPulse() {
  const cameraPulseActive = useStore((s) => s.cameraPulseActive);
  const setCameraPulseActive = useStore((s) => s.setCameraPulseActive);
  const updateVegaLivePulse = useStore((s) => s.updateVegaLivePulse);
  const liveCameraBpm = useStore((s) => s.liveCameraBpm);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [bpm, setBpm] = useState<number | null>(null);
  const [quality, setQuality] = useState<'poor' | 'fair' | 'good'>('poor');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Optical rPPG signal buffers
  const signalBuffer = useRef<number[]>([]);
  const lastBpmPush = useRef<number>(0);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraPulseActive(false);
    setBpm(null);
    signalBuffer.current = [];
  };

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: 'user', width: {ideal: 320}, height: {ideal: 240}},
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraPulseActive(true);
      processFrame();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera permission denied or unavailable';
      setErrorMsg(msg);
      setCameraPulseActive(false);
    }
  };

  const processFrame = () => {
    const video = videoRef.current;
    const sampleCanvas = sampleCanvasRef.current;
    const waveCanvas = waveCanvasRef.current;

    if (!video || !sampleCanvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const sCtx = sampleCanvas.getContext('2d', {willReadFrequently: true});
    if (!sCtx) return;

    // Sample central 25% region
    const sw = 60;
    const sh = 60;
    const sx = Math.max(0, (video.videoWidth - sw) / 2);
    const sy = Math.max(0, (video.videoHeight - sh) / 2);

    sCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    const imgData = sCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    let greenSum = 0;
    for (let i = 1; i < data.length; i += 4) {
      greenSum += data[i]; // Green channel has maximum photoplethysmographic absorption contrast
    }
    const meanGreen = greenSum / (data.length / 4);

    // Buffer the raw values
    const buf = signalBuffer.current;
    buf.push(meanGreen);
    if (buf.length > 200) buf.shift();

    // Detrend & moving average filter
    if (buf.length > 30) {
      const recent = buf.slice(-60);
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;

      // Peak detection for interval estimation
      const peaks: number[] = [];
      for (let i = 2; i < recent.length - 2; i++) {
        const v = recent[i] - mean;
        if (
          v > 0.4 &&
          v > recent[i - 1] - mean &&
          v > recent[i - 2] - mean &&
          v > recent[i + 1] - mean &&
          v > recent[i + 2] - mean
        ) {
          peaks.push(i);
        }
      }

      if (peaks.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < peaks.length; i++) {
          intervals.push(peaks[i] - peaks[i - 1]);
        }
        intervals.sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        // Assuming ~30 fps: bpm = (30 / medianInterval) * 60
        const estimatedBpm = Math.round((30 / medianInterval) * 60);

        if (estimatedBpm >= 45 && estimatedBpm <= 175) {
          setBpm(estimatedBpm);
          setQuality('good');

          // Push to Vega HR stream every ~1 second
          const now = Date.now();
          if (now - lastBpmPush.current > 1000) {
            lastBpmPush.current = now;
            updateVegaLivePulse(estimatedBpm);
          }
        } else {
          setQuality('fair');
        }
      } else {
        setQuality('poor');
      }

      // Render live waveform
      if (waveCanvas) {
        const wCtx = waveCanvas.getContext('2d');
        if (wCtx) {
          const w = waveCanvas.width;
          const h = waveCanvas.height;
          wCtx.clearRect(0, 0, w, h);

          wCtx.strokeStyle = quality === 'good' ? '#6fb6ff' : '#e0b03a';
          wCtx.lineWidth = 2;
          wCtx.beginPath();

          const step = w / 60;
          for (let i = 0; i < recent.length; i++) {
            const val = (recent[i] - mean) * 6;
            const y = h / 2 - val;
            if (i === 0) wCtx.moveTo(0, y);
            else wCtx.lineTo(i * step, y);
          }
          wCtx.stroke();
        }
      }
    }

    rafRef.current = requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="rounded-lg bg-void-2 p-5 ring-1 ring-white/10 space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-sm tracking-wider text-white uppercase">
            Optical rPPG Pulse Bridge
          </span>
          <span className="rounded bg-earth/20 text-earth px-1.5 py-0.5 text-[11px] font-bold uppercase">
            X05 Local Signal
          </span>
        </div>
        {cameraPulseActive && (
          <span className="flex items-center gap-1.5 text-earth text-[11px]">
            <span className="size-2 rounded-full bg-earth animate-pulse" />
            Live Sensing Active
          </span>
        )}
      </div>

      {errorMsg ? (
        <div className="rounded bg-mars/15 p-3.5 border border-mars/30 text-regolith/90 space-y-2">
          <p className="text-mars font-bold">Camera Access Error: {errorMsg}</p>
          <p className="text-[11px] text-regolith/70 font-sans">
            Unable to stream local camera. Browser permissions may be denied or blocked by sandbox.
          </p>
          <button
            type="button"
            onClick={stopCamera}
            className="rounded bg-white/10 px-3 py-1 text-white uppercase hover:bg-white/20"
          >
            Use simulated pulse instead
          </button>
        </div>
      ) : !cameraPulseActive ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
          <div className="space-y-1">
            <p className="text-white font-medium">Measure real pulse using device camera</p>
            <p className="text-[11px] text-regolith/60 font-sans">
              Detects micro-pulsatile skin reflectance through your camera's green color spectrum.
            </p>
          </div>
          <button
            type="button"
            onClick={startCamera}
            className="rounded bg-earth px-4 py-2 font-bold text-void uppercase hover:bg-earth/90 transition-colors shrink-0"
          >
            Measure my pulse
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-12 items-center">
            {/* Live Video Preview (Small) & Canvas */}
            <div className="sm:col-span-4 relative rounded overflow-hidden aspect-video bg-black/60 border border-white/15">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <canvas ref={sampleCanvasRef} width={60} height={60} className="hidden" />
              <div className="absolute inset-0 border border-earth/40 pointer-events-none flex items-center justify-center">
                <div className="size-12 border border-earth/80 rounded-sm" />
              </div>
              <span className="absolute bottom-1 left-1.5 text-[11px] bg-black/70 px-1 rounded text-white/70">
                Central ROI
              </span>
            </div>

            {/* Live Waveform Oscilloscope & Pulse Metrics */}
            <div className="sm:col-span-8 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-regolith/50 uppercase block">Optical Pulse Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold text-white">
                      {bpm ?? liveCameraBpm ?? '--'}
                    </span>
                    <span className="text-regolith/60">BPM</span>
                    <span className="rounded bg-earth/20 text-earth px-1.5 py-0.2 text-[11px] font-bold">
                      REAL
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-regolith/50 uppercase block">Signal Quality</span>
                  <span
                    className={`font-bold uppercase ${
                      quality === 'good'
                        ? 'text-earth'
                        : quality === 'fair'
                        ? 'text-[#e0b03a]'
                        : 'text-mars'
                    }`}
                  >
                    {quality}
                  </span>
                </div>
              </div>

              {/* Waveform Canvas */}
              <div className="h-14 w-full rounded bg-void p-1 border border-white/10">
                <canvas ref={waveCanvasRef} width={300} height={48} className="w-full h-full" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-regolith/60 animate-pulse">
                  Hold still, face the camera...
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded bg-white/10 px-3 py-1 text-white uppercase hover:bg-white/20 transition-colors"
                >
                  Stop Camera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimers & Privacy */}
      <div className="border-t border-white/5 pt-3 space-y-1 text-[11px] text-regolith/50">
        <p>🔒 Camera frames are processed in your browser and never leave it.</p>
        <p>⚠️ Not medical grade. Evaluates optical green channel reflectance only; never estimates SpO2.</p>
      </div>
    </div>
  );
}
