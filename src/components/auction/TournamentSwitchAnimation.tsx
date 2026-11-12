import { useEffect, useState } from 'react';
import './TournamentSwitchAnimation.css';

interface TournamentSwitchAnimationProps {
  isVisible: boolean;
  direction: 'ltr' | 'rtl'; // left-to-right or right-to-left
  onAnimationComplete?: () => void;
}

export function TournamentSwitchAnimation({
  isVisible,
  direction,
  onAnimationComplete,
}: TournamentSwitchAnimationProps) {
  useEffect(() => {
    if (isVisible) {
      console.log('🎬 Tournament animation started:', direction);
      const timer = setTimeout(() => {
        console.log('🎬 Tournament animation completed');
        onAnimationComplete?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onAnimationComplete]);

  if (!isVisible) {
    return null;
  }

  console.log('🎬🎬🎬 ANIMATION RENDERING 🎬🎬🎬', { isVisible, direction });

  return (
    <div className={`tournament-switch-animation ${direction}`} style={{ display: 'block' }}>
      {/* Cricket Batter */}
      <svg
        className="cricket-batter"
        viewBox="0 0 100 150"
        width="80"
        height="120"
      >
        {/* Head */}
        <circle cx="50" cy="20" r="12" fill="#f4a460" stroke="#8b6914" strokeWidth="1" />
        {/* Body */}
        <rect x="45" y="35" width="10" height="30" fill="#1a1a2e" stroke="#000" strokeWidth="0.5" />
        {/* Arms - Left (batting position) */}
        <line x1="45" y1="40" x2="20" y2="30" stroke="#f4a460" strokeWidth="4" strokeLinecap="round" />
        <line x1="20" y1="30" x2="10" y2="20" stroke="#8b6914" strokeWidth="3" strokeLinecap="round" />
        {/* Arms - Right */}
        <line x1="55" y1="40" x2="70" y2="35" stroke="#f4a460" strokeWidth="4" strokeLinecap="round" />
        {/* Legs */}
        <line x1="47" y1="65" x2="45" y2="95" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" />
        <line x1="53" y1="65" x2="55" y2="95" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" />
        {/* Bat */}
        <g className="bat">
          <line x1="10" y1="18" x2="-20" y2="-10" stroke="#8b4513" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="-18" cy="-12" rx="5" ry="8" fill="#a0522d" />
        </g>
      </svg>

      {/* Cricket Ball */}
      <svg
        className="cricket-ball"
        viewBox="0 0 40 40"
        width="40"
        height="40"
      >
        <defs>
          <radialGradient id="ballGradient">
            <stop offset="0%" stopColor="#ff4444" />
            <stop offset="100%" stopColor="#cc0000" />
          </radialGradient>
        </defs>
        {/* Ball */}
        <circle cx="20" cy="20" r="18" fill="url(#ballGradient)" stroke="#990000" strokeWidth="1" />
        {/* Stitching */}
        <path
          d="M 20 5 Q 25 10 28 15 Q 30 20 28 25"
          stroke="#ffffff"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 20 5 Q 15 10 12 15 Q 10 20 12 25"
          stroke="#ffffff"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Shine */}
        <ellipse cx="12" cy="12" rx="5" ry="4" fill="#ffaaaa" opacity="0.6" />
      </svg>

      {/* Trail particles */}
      <div className="particle particle-1" />
      <div className="particle particle-2" />
      <div className="particle particle-3" />
      <div className="particle particle-4" />

      {/* Impact effect */}
      <div className="impact-burst">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export default TournamentSwitchAnimation;
