import React from 'react';
import { Player } from '../types';
import { AVATARS } from '../constants';
import { Trophy, Medal, Flag } from 'lucide-react';

interface PlayerAvatarProps {
  player: Player;
  isActive: boolean;
  cardCount: number;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, isActive, cardCount }) => {
  
  const getRankBadge = (rank: number) => {
    switch(rank) {
      case 1: return { text: '头游', color: 'bg-yellow-500', icon: <Trophy size={14} /> };
      case 2: return { text: '二游', color: 'bg-stone-400', icon: <Medal size={14} /> };
      case 3: return { text: '三游', color: 'bg-orange-700', icon: <Medal size={14} /> };
      case 4: return { text: '末游', color: 'bg-slate-700', icon: <Flag size={14} /> };
      default: return null;
    }
  };

  const rankInfo = player.finishedRank ? getRankBadge(player.finishedRank) : null;

  // Determine bubble position based on player position
  // For 'top' player (Opponent), move bubble to the right side to avoid overlapping top edge or cards
  const isTop = player.position === 'top';
  const bubblePositionClass = isTop 
    ? "absolute top-4 left-[110%] z-20 w-max" 
    : "absolute -top-8 left-1/2 -translate-x-1/2 z-20 w-max";

  return (
    <div className={`flex flex-col items-center gap-2 relative ${isActive ? 'scale-110 transition-transform' : 'opacity-90'} ${player.finishedRank ? 'opacity-70' : ''}`}>
      
      {/* Action Indicator Bubble (Only show if not finished) */}
      {!player.finishedRank && player.lastAction && (
        <div className={`
          ${bubblePositionClass} px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-bounce
          ${player.lastAction === 'pass' 
            ? 'bg-stone-600 text-stone-300 border border-stone-500' 
            : 'bg-green-500 text-white border border-green-400'}
        `}>
          {player.lastAction === 'pass' ? '过牌' : '出牌'}
        </div>
      )}

      <div className={`
        relative w-16 h-16 landscape:w-12 landscape:h-12 md:w-20 md:h-20 
        rounded-full border-4 overflow-hidden shadow-lg transition-all duration-300
        ${isActive ? 'border-yellow-400 shadow-yellow-500/50' : 'border-stone-600'}
        ${player.team === 1 ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-stone-800' : 'ring-2 ring-red-500 ring-offset-2 ring-offset-stone-800'}
      `}>
        <img 
          src={AVATARS[player.position]} 
          alt={player.name} 
          className={`w-full h-full object-cover ${player.lastAction === 'pass' ? 'grayscale opacity-60' : ''}`}
        />
        {isActive && (
          <div className="absolute inset-0 bg-yellow-400 opacity-20 animate-pulse"></div>
        )}
        
        {/* Finished Overlay */}
        {rankInfo && (
           <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <div className={`${rankInfo.color} p-1.5 rounded-full shadow-lg text-white`}>
                 {rankInfo.icon}
              </div>
           </div>
        )}
      </div>
      
      {/* Card Count or Rank Label */}
      <div className={`
        absolute -top-2 -right-2 text-xs landscape:text-[10px] md:text-sm px-2 py-0.5 rounded-full border shadow-sm font-mono flex items-center gap-1
        ${rankInfo 
          ? `${rankInfo.color} text-white border-white/20` 
          : 'bg-stone-800 text-white border-stone-600'}
      `}>
        {rankInfo ? rankInfo.text : cardCount}
      </div>

      <div className="text-center">
        <div className="text-xs landscape:text-[10px] md:text-sm font-bold text-white shadow-black drop-shadow-md">{player.name}</div>
        <div className="text-[10px] md:text-xs text-stone-400 uppercase tracking-wider scale-90">{player.role}</div>
      </div>
      
    </div>
  );
};

export default PlayerAvatar;