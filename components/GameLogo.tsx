import React from 'react';

interface GameLogoProps {
  size?: number;
  variant?: 'icon' | 'full' | 'text';
  className?: string;
}

const GameLogo: React.FC<GameLogoProps> = ({ size = 64, variant = 'full', className = '' }) => {
  // Styles
  const goldGradient = "url(#gold-gradient)";
  const redGradient = "url(#red-gradient)";
  const cardShadow = "drop-shadow(0px 4px 6px rgba(0,0,0,0.5))";
  
  return (
    <div className={`flex flex-col items-center justify-center ${className}`} style={{ width: variant === 'full' ? 'auto' : size, height: variant === 'full' ? 'auto' : size }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 512 512" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="gold-gradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="40%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#A16207" />
          </linearGradient>
          <linearGradient id="red-gradient" x1="100" y1="100" x2="400" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <linearGradient id="text-gradient" x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
             <stop offset="0%" stopColor="#FFF" />
             <stop offset="100%" stopColor="#FDE047" />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="black" floodOpacity="0.5"/>
          </filter>
        </defs>

        {/* Background Circle (Only for Icon variant usually, but good for depth) */}
        {variant === 'icon' && (
           <rect x="20" y="20" width="472" height="472" rx="100" fill="#1c1917" stroke={goldGradient} strokeWidth="16" />
        )}

        {/* --- CARDS FAN (Background) --- */}
        <g transform="translate(256, 300) scale(0.95)">
            {/* Left Card */}
            <g transform="rotate(-20) translate(-120, -140)" style={{ filter: cardShadow }}>
                <rect x="0" y="0" width="140" height="200" rx="12" fill="white" stroke="#CBD5E1" strokeWidth="4" />
                <text x="20" y="40" fontFamily="serif" fontSize="32" fontWeight="bold" fill="#1E293B">A</text>
                <text x="70" y="120" fontSize="60" fill="#1E293B" textAnchor="middle">♠</text>
            </g>

            {/* Right Card */}
            <g transform="rotate(20) translate(-20, -140)" style={{ filter: cardShadow }}>
                <rect x="0" y="0" width="140" height="200" rx="12" fill="white" stroke="#CBD5E1" strokeWidth="4" />
                <text x="120" y="40" fontFamily="serif" fontSize="32" fontWeight="bold" fill="#EF4444" textAnchor="middle">A</text>
                <text x="70" y="120" fontSize="60" fill="#EF4444" textAnchor="middle">♥</text>
            </g>

            {/* Center Card */}
            <g transform="translate(-70, -160)" style={{ filter: cardShadow }}>
                <rect x="0" y="0" width="140" height="200" rx="12" fill="white" stroke={goldGradient} strokeWidth="6" />
                <rect x="10" y="10" width="120" height="180" rx="8" fill="#991B1B" fillOpacity="0.1" />
            </g>
        </g>

        {/* --- TEXT BANNER --- */}
        {/* Large "掼蛋" text overlaying the cards */}
        <g transform="translate(256, 320)" style={{ filter: "url(#shadow)" }}>
             <text 
                x="0" y="0" 
                textAnchor="middle" 
                fontSize="160" 
                fontWeight="900" 
                fontFamily="'Noto Serif SC', serif"
                fill="url(#gold-gradient)"
                stroke="#451a03"
                strokeWidth="8"
                paintOrder="stroke"
             >
                掼蛋
             </text>
        </g>

        {/* --- CROWN (Top) --- */}
        <g transform="translate(256, 110) scale(1.0)" style={{ filter: "drop-shadow(0px 0px 15px rgba(234, 179, 8, 0.5))" }}>
             <path 
                d="M-120 -40 L-70 80 L-20 20 L0 90 L20 20 L70 80 L120 -40 L90 120 H-90 Z" 
                fill={goldGradient} 
                stroke="#713F12" 
                strokeWidth="4"
                strokeLinejoin="round"
             />
             {/* Jewels */}
             <circle cx="0" cy="-60" r="14" fill="#EF4444" stroke="#78350F" strokeWidth="2" />
             <circle cx="-120" cy="-40" r="12" fill="#EF4444" stroke="#78350F" strokeWidth="2" />
             <circle cx="120" cy="-40" r="12" fill="#EF4444" stroke="#78350F" strokeWidth="2" />
             <circle cx="0" cy="90" r="10" fill="#3B82F6" stroke="#1E3A8A" strokeWidth="2" />
        </g>
      </svg>
      
      {/* English Subtitle */}
      {variant === 'full' && (
          <div className="flex flex-col items-center -mt-4">
            <div className="text-sm md:text-base tracking-[0.5em] text-yellow-500/90 font-bold uppercase drop-shadow-md">
                Guandan Master
            </div>
          </div>
      )}
    </div>
  );
};

export default GameLogo;