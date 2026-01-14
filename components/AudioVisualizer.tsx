
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  stream: MediaStream | null;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive || !stream || !canvasRef.current) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      return;
    }

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512; // High resolution
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const barHeight = (value / 255) * height * 0.9;
        
        // High-tech aesthetic gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.2)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.6)');
        gradient.addColorStop(1, 'rgba(167, 139, 250, 0.9)');
        
        ctx.fillStyle = gradient;
        // Rounded corners simulated with tiny vertical rects
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [isActive, stream]);

  return (
    <div className="w-full h-12 md:h-16 flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden px-4 border border-white/5 group transition-all hover:bg-black/60">
      {isActive ? (
        <canvas ref={canvasRef} width={800} height={100} className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
      ) : (
        <div className="text-slate-600 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
          Neural Input Inactive
        </div>
      )}
    </div>
  );
};
