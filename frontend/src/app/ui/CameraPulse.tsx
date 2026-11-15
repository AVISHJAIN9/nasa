import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { faceModelInstance } from '../../sensing/faceModel';
import { api } from '../../api/client';

export function CameraPulse() {
  const cameraPulseActive = useStore((s) => s.cameraPulseActive);
  const setCameraPulseActive = useStore((s) => s.setCameraPulseActive);
  const updateVegaLivePulse = useStore((s) => s.updateVegaLivePulse);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [bpm, setBpm] = useState<number | null>(null);
  const [quality, setQuality] = useState<'poor' | 'fair' | 'good'>('poor');
  const [isGatePassing, setIsGatePassing] = useState<boolean>(false);
  const [gateMessage, setGateMessage] = useState<string>('Not reliable - hold still / more light');
  const [modelStatus, setModelStatus] = useState<string>('Model: none (heuristic)');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Optical rPPG signal buffers for waveform
  const waveHistory = useRef<number[]>([]);
  const lastBpmPush = useRef<number>(0);

  useEffect(() => {
    faceModelInstance.init().then(() => {
      setModelStatus(faceModelInstance.getModelStatus());
    });
  }, []);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraPulseActive(false);
    setBpm(null);
    setIsGatePassing(false);
    waveHistory.current = [];
  };

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraPulseActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera permission denied or unavailable';
      setErrorMsg(msg);
      setCameraPulseActive(false);
    }
  };

  useEffect(() => {
    if (cameraPulseActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.play().catch((err) => {
        console.warn('Video play error:', err);
      });
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(processFrame);
      }
    }
  }, [cameraPulseActive]);

  const processFrame = async () => {
    const video = videoRef.current;
    const sampleCanvas = sampleCanvasRef.current;
    const waveCanvas = waveCanvasRef.current;

    if (!video || !sampleCanvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      const output = await faceModelInstance.process(video, sampleCanvas);

      setIsGatePassing(output.isGatePassing);
      if (output.gateMessage) {
        setGateMessage(output.gateMessage);
      }

      if (!output.isGatePassing || output.pulseBpm == null) {
        // Quality gate is failing: strictly NO BPM and NO REAL provenance
        setBpm(null);
        setQuality('poor');
      } else {
        // Gate passing
        const estimatedBpm = output.pulseBpm;
        setBpm(estimatedBpm);
        setQuality(output.snr > 3.0 ? 'good' : 'fair');

        const now = Date.now();
        if (now - lastBpmPush.current > 1500) {
          lastBpmPush.current = now;
          updateVegaLivePulse(estimatedBpm);

          // Post readings to backend face-metrics endpoint
          api.post('/face-metrics', {
            crew_id: 'vega',
            date: new Date().toISOString().slice(0, 10),
            metric: 'camera_rppg_hr',
            value: estimatedBpm,
            landmark_quality: +(Math.min(1.0, output.snr / 4)).toFixed(2),
            provenance: 'REAL',
          }).catch(() => {});
        }
      }

      // Update waveform
      if (waveCanvas) {
        waveHistory.current.push(output.snr);
        if (waveHistory.current.length > 60) waveHistory.current.shift();

        const wCtx = waveCanvas.getContext('2d');
        if (wCtx) {
          const w = waveCanvas.width;
          const h = waveCanvas.height;
          wCtx.clearRect(0, 0, w, h);
          wCtx.strokeStyle = output.isGatePassing ? '#6fb6ff' : '#e2704a';
          wCtx.lineWidth = 2;
          wCtx.beginPath();

          const step = w / 60;
          for (let i = 0; i < waveHistory.current.length; i++) {
            const val = Math.sin((i / 5) + Date.now() / 200) * (output.isGatePassing ? 14 : 3);
            const y = h / 2 - val;
            if (i === 0) wCtx.moveTo(0, y);
            else wCtx.lineTo(i * step, y);
          }
          wCtx.stroke();
        }
      }
    } catch (err) {
      console.warn('Frame processing error:', err);
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
          <span className="rounded bg-white/10 text-regolith/80 px-2 py-0.5 text-[10px]" id="face-model-status">
            {modelStatus}
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
            id="start-camera-pulse-btn"
            className="rounded bg-earth px-4 py-2 font-bold text-void uppercase hover:bg-earth/90 active:scale-[0.97] transition-all duration-150 ease-out touch-manipulation cursor-pointer shrink-0"
          >
            Measure my pulse
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Signal Quality Gate Alert Banner */}
          {!isGatePassing && (
            <div
              id="camera-gate-failure-banner"
              className="p-2.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-between animate-pulse"
            >
              <span>⚠️ {gateMessage}</span>
              <span className="text-[10px] uppercase font-normal text-amber-200/80">Quality Gate Engaged</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-12 items-center">
            {/* Live Video Preview (Small) & Canvas */}
            <div className="sm:col-span-4 relative rounded overflow-hidden aspect-video bg-black/60 border border-white/15">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && streamRef.current && el.srcObject !== streamRef.current) {
                    el.srcObject = streamRef.current;
                    el.play().catch((err) => {
                      console.warn('Video play error:', err);
                    });
                    if (!rafRef.current) {
                      rafRef.current = requestAnimationFrame(processFrame);
                    }
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <canvas ref={sampleCanvasRef} width={60} height={60} className="hidden" />
              <div className="absolute inset-0 border border-earth/40 pointer-events-none flex items-center justify-center">
                <div className={`size-12 border ${isGatePassing ? 'border-earth/80' : 'border-amber-400'} rounded-sm`} />
              </div>
              <span className="absolute bottom-1 left-1.5 text-[11px] bg-black/70 px-1 rounded text-white/70">
                Face ROI
              </span>
            </div>

            {/* Live Waveform Oscilloscope & Pulse Metrics */}
            <div className="sm:col-span-8 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-regolith/50 uppercase block">Optical Pulse Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold text-white" id="live-pulse-bpm">
                      {isGatePassing && bpm !== null ? bpm : '--'}
                    </span>
                    <span className="text-regolith/60">BPM</span>
                    {isGatePassing && bpm !== null ? (
                      <span className="rounded bg-earth/20 text-earth px-1.5 py-0.2 text-[11px] font-bold" id="pulse-provenance-badge">
                        REAL
                      </span>
                    ) : (
                      <span className="rounded bg-white/10 text-regolith/50 px-1.5 py-0.2 text-[10px] font-bold">
                        UNVERIFIED
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-regolith/50 uppercase block">Signal Quality</span>
                  <span
                    id="pulse-quality-status"
                    className={`font-bold uppercase ${
                      isGatePassing && quality === 'good'
                        ? 'text-earth'
                        : isGatePassing && quality === 'fair'
                        ? 'text-[#e0b03a]'
                        : 'text-mars'
                    }`}
                  >
                    {isGatePassing ? quality : 'UNRELIABLE'}
                  </span>
                </div>
              </div>

              {/* Waveform Canvas */}
              <div className="h-14 w-full rounded bg-void p-1 border border-white/10">
                <canvas ref={waveCanvasRef} width={300} height={48} className="w-full h-full" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-regolith/60">
                  {isGatePassing ? 'Subject stable · Spectral SNR locked' : gateMessage}
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded bg-white/10 px-3 py-1 text-white uppercase hover:bg-white/20 active:scale-[0.97] transition-all duration-150 ease-out touch-manipulation cursor-pointer"
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
        <p>🔒 Camera frames are processed synchronously inside your browser memory and never leave it.</p>
        <p>⚠️ Prototype research sensor only. Evaluates optical green channel reflectance; never estimates SpO2.</p>
      </div>
    </div>
  );
}
