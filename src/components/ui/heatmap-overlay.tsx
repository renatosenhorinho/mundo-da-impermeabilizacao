import React, { useEffect, useState, useRef } from 'react';
import { getAnalyticsEvents, AnalyticsEvent } from '@/lib/analytics';

export const HeatmapOverlay: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  useEffect(() => {
    if (active) {
      setEvents(getAnalyticsEvents().filter(e => e.type === 'click' || e.type === 'product_click'));
    }
  }, [active]);

  useEffect(() => {
    if (!active || !canvasRef.current || events.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match document size
    const updateCanvasSize = () => {
      canvas.width = Math.max(
        document.body.scrollWidth, document.documentElement.scrollWidth,
        document.body.offsetWidth, document.documentElement.offsetWidth,
        document.body.clientWidth, document.documentElement.clientWidth
      );
      canvas.height = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      );
      drawHeatmap();
    };

    const drawHeatmap = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const currentPath = window.location.pathname;
      const relevantEvents = events.filter(e => e.page === currentPath && e.x !== undefined && e.y !== undefined);

      if (relevantEvents.length === 0) return;

      // Draw points
      relevantEvents.forEach(e => {
        const x = e.x!;
        const y = e.y!;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 40);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.4)');
        gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [active, events]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full z-[9999] pointer-events-none mix-blend-multiply opacity-80"
      style={{ height: 'auto', minHeight: '100%' }}
    />
  );
};
