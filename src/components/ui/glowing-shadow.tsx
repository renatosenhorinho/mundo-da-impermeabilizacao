import { type ReactNode } from 'react'

interface GlowingShadowProps {
  children: ReactNode
  glowColor?: string
}

export function GlowingShadow({ children, glowColor = '#0059b3' }: GlowingShadowProps) {
  return (
    <>
      <style>{`
        .glow-box {
          position: relative;
          z-index: 2;
          cursor: pointer;
          width: 100%;
          transition: transform 0.3s ease-out;
        }

        .glow-box:hover {
          transform: translateY(-6px);
        }

        .glow-box .glow-inner {
          position: relative;
          z-index: 2;
          border-radius: 12px;
          overflow: hidden;
          background: white;
          transition: box-shadow 0.3s ease-out;
        }

        .glow-box:hover .glow-inner {
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
        }

        .glow-box .glow-ring {
          position: absolute;
          inset: -2px;
          border-radius: 14px;
          z-index: 0;
          opacity: 0;
          transition: opacity 0.3s ease-out;
          pointer-events: none;
        }

        .glow-box:hover .glow-ring {
          opacity: 1;
        }

        .glow-box .glow-blur {
          position: absolute;
          inset: -12px;
          border-radius: 24px;
          z-index: -1;
          opacity: 0;
          filter: blur(20px);
          transition: opacity 0.3s ease-out;
          pointer-events: none;
        }

        .glow-box:hover .glow-blur {
          opacity: 0.4;
        }
      `}</style>

      <div className="glow-box group">
        {/* Static glow ring behind the card */}
        <div
          className="glow-ring"
          style={{
            background: `conic-gradient(from 0deg, ${glowColor}00, ${glowColor}33 10%, ${glowColor} 25%, ${glowColor}33 40%, ${glowColor}00 50%, ${glowColor}33 60%, ${glowColor} 75%, ${glowColor}33 90%, ${glowColor}00)`,
          }}
        />
        {/* Blurred static glow behind */}
        <div
          className="glow-blur"
          style={{ background: glowColor }}
        />
        {/* Actual card content */}
        <div className="glow-inner">
          {children}
        </div>
      </div>
    </>
  )
}
