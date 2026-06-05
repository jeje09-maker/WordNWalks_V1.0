'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SpiritualWaveProps {
  activityLevel?: number;
  className?: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function SpiritualWave({ activityLevel = 0, className }: SpiritualWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;

    const resizeCanvas = () => {
      if(canvas.parentElement) {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
      }
    };
    
    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    
    const colorPalette = [
      { h: 220, s: 75, l: 45 }, // Ocean Blue (Darker)
      { h: 210, s: 85, l: 55 }, // Sky Blue (Darker)
      { h: 240, s: 60, l: 35 }, // Deep Indigo
      { h: 205, s: 90, l: 65 }, // Light Cyan
    ];

    const draw = () => {
      if (!ctx || !canvas) return;
      frameCount++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const clampedActivity = Math.max(0, Math.min(1, activityLevel));
      const easedActivity = clampedActivity * clampedActivity;

      let activeColors = [colorPalette[0]];
      if (clampedActivity > (6.5 / 7)) {
        activeColors = colorPalette;
      } else if (clampedActivity > (5.5 / 7)) {
        activeColors = colorPalette.slice(0, 3);
      } else if (clampedActivity > (4.5 / 7)) {
        activeColors = colorPalette.slice(0, 2);
      }
      
      const waveCount = Math.round(lerp(2, 7, clampedActivity));
      const baseAmplitude = lerp(clampedActivity < (2.5/7) ? 2 : 10, 60, easedActivity);
      const speed = lerp(0.003, 0.015, easedActivity);

      for (let i = 0; i < waveCount; i++) {
        const progress = waveCount > 1 ? i / (waveCount - 1) : 1;
        const amplitude = baseAmplitude * (1 - progress * 0.7);
        const frequency = lerp(0.005, 0.01, progress);
        const phase = frameCount * speed * (i % 2 === 0 ? 1 : -0.8) + i * 20;
        const opacity = lerp(0.85, 0.25, progress) * lerp(0.6, 1, clampedActivity);

        const color = activeColors[i % activeColors.length];

        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        const points = [];
        for (let x = 0; x <= canvas.width; x += 2) {
          const mainWave = Math.sin(x * frequency + phase) * amplitude;
          const perturbationWave = Math.cos(x * (frequency * 0.5) + frameCount * speed * 0.3) * (amplitude * 0.3);
          const y = mainWave + perturbationWave + canvas.height * 0.9;
          points.push({ x, y });
          ctx.lineTo(x, y);
        }
        
        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${opacity})`;
        ctx.fill();

        // 1. 가늘고 진한 상단 윤곽선 추가
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l - 15}%, ${opacity + 0.1})`;
        ctx.lineWidth = 0.5;
        points.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // 2. 물결 내부에서만 나타나는 가는 흰색 선들
        ctx.lineWidth = 0.6;
        for (let j = 0; j < 2; j++) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
            const yOffset = (j + 1) * 8; // 물결 아래로 오프셋
            points.forEach((p, idx) => {
                const innerY = p.y + yOffset;
                // 캔버스 범위를 넘지 않도록 제한
                if (innerY < canvas.height) {
                    if (idx === 0) ctx.moveTo(p.x, innerY);
                    else ctx.lineTo(p.x, innerY);
                }
            });
            ctx.stroke();
        }
      }

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [activityLevel]);

  return (
    <div className={cn("absolute inset-0 h-full w-full pointer-events-none", className)}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}