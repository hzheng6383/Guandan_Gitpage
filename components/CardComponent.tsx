import React from 'react';
import { Card as CardType } from '../types';
import { SUIT_COLORS, SUIT_SYMBOLS } from '../constants';
import { Sparkles } from 'lucide-react';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  mini?: boolean;
  /**
   * 'row': 内容横向排列 (点数 花色) - 适合垂直堆叠的牌（左右侧玩家）- 内容需靠上
   * 'col': 内容竖向排列 (点数 上, 花色 下) - 适合水平展开的牌（对家/上方玩家）- 内容需靠左
   */
  miniLayout?: 'row' | 'col';
  /**
   * If true, renders the top-left rank/suit horizontally to save vertical space.
   * Used for stacked cards.
   */
  compact?: boolean;
  /**
   * If true, selected card does NOT move up (translateY). 
   * Useful for stacked views where moving up obscures cards behind.
   */
  disableSelectionMove?: boolean;
}

const CardComponent: React.FC<CardProps> = ({
  card,
  isSelected,
  onClick,
  className = "",
  mini = false,
  miniLayout = 'row',
  compact = false,
  disableSelectionMove = false
}) => {
  const colorClass = card.rank === 'RJ' ? 'text-red-600' : (card.rank === 'BJ' ? 'text-slate-900' : SUIT_COLORS[card.suit]);

  const displayRank = card.rank === 'BJ' ? '小王' : card.rank === 'RJ' ? '大王' : card.rank;
  const displaySuit = (card.rank === 'BJ' || card.rank === 'RJ') ? '' : SUIT_SYMBOLS[card.suit];

  // Modified: Added 'brightness-90 bg-stone-100' to visually dim the selected card slightly
  const moveClass = (isSelected && !disableSelectionMove) ? '-translate-y-4 sm:-translate-y-6' : '';
  const transformStyle = isSelected
    ? `${moveClass} brightness-75 bg-stone-200 ring-2 ring-yellow-500/80 shadow-inner`
    : 'hover:brightness-105';

  if (mini) {
    // Mini Card Logic
    // FIX: Always align items to start (Top/Left) to avoid stacking hiding the value
    const isRow = miniLayout === 'row';

    return (
      <div
        className={`
          relative bg-white rounded-[2px] shadow-sm border border-slate-400 select-none
          flex ${isRow ? 'flex-row items-start' : 'flex-col items-start'} 
          pt-0.5 pl-1 gap-0.5
          w-9 h-11 md:w-10 md:h-12
          ${colorClass} ${className}
          ${card.isWild ? 'ring-1 ring-red-400 bg-white' : ''}
        `}
      >
        <div className="text-[11px] font-black leading-none">{card.rank === 'RJ' ? '王' : card.rank === 'BJ' ? '王' : displayRank}</div>
        <div className="text-[11px] leading-none">{displaySuit}</div>
        {card.isWild && (
          <div className="absolute top-0 right-0">
            <Sparkles size={4} className="text-red-500 fill-red-500" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`
        relative bg-white rounded shadow-md border border-slate-300 select-none transition-all duration-200
        w-10 h-14 sm:w-12 sm:h-16 md:w-14 md:h-20 lg:w-16 lg:h-24
        flex flex-col justify-between p-0.5
        ${transformStyle}
        ${card.isWild ? 'ring-2 ring-red-500 bg-white' : card.isLevelCard && !isSelected ? 'ring-2 ring-blue-400 bg-white' : ''}
        ${className}
      `}
    >
      {/* Top Left */}
      <div className={`text-left leading-none ${colorClass} flex flex-nowrap ${compact ? 'flex-row items-center gap-0.5 pl-1 pt-0.5' : 'flex-col items-start pl-1'} w-full`}>
        <div className={`font-black tracking-tighter ${card.rank === 'RJ' || card.rank === 'BJ' ? 'text-[10px] sm:text-xs md:text-sm lg:text-base' : 'text-sm sm:text-lg md:text-2xl lg:text-3xl'}`}>
          {displayRank}
        </div>
        <div className={`text-[10px] sm:text-sm md:text-base lg:text-xl ${compact ? 'mb-0' : '-mt-0.5 ml-0.5'}`}>{displaySuit}</div>
      </div>

      {/* Center Watermark - Hidden in compact mode to prevent "Double Suit" confusion or clutter */}
      {!compact && (
        <div className={`absolute inset-0 flex items-center justify-center opacity-[0.12] pointer-events-none ${colorClass}`}>
          <span className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl">{displaySuit}</span>
        </div>
      )}

      {/* Joker Text Vertical */}
      {!compact && (card.rank === 'BJ' || card.rank === 'RJ') && (
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${colorClass}`}>
          <div className="flex flex-col text-[10px] sm:text-xs md:text-sm lg:text-base font-black tracking-widest opacity-80" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
            {card.rank === 'RJ' ? '大王' : '小王'}
          </div>
        </div>
      )}

      {/* Wild Card Badge */}
      {card.isWild && (
        <div className="absolute top-0.5 right-0.5">
          <div className="bg-red-500 text-white text-[5px] sm:text-[6px] md:text-[8px] px-1 py-0 rounded-full shadow flex items-center gap-0.5">
            <Sparkles size={3} className="fill-white" />
            <span className="font-bold">配</span>
          </div>
        </div>
      )}

      {/* Level Card Indicator */}
      {card.isLevelCard && !card.isWild && (
        <div className="absolute top-1 right-1 opacity-60">
          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full shadow-sm"></div>
        </div>
      )}

      {/* Bottom Right (Inverted) */}
      {!compact && (
        <div className={`absolute bottom-0.5 right-0.5 transform rotate-180 text-left leading-none ${colorClass} flex flex-col items-center w-3.5 sm:w-5 md:w-6 lg:w-8`}>
          <div className={`font-black tracking-tighter ${card.rank === 'RJ' || card.rank === 'BJ' ? 'text-[10px] sm:text-xs md:text-sm lg:text-base' : 'text-sm sm:text-lg md:text-2xl lg:text-3xl'}`}>
            {displayRank}
          </div>
          <div className="text-[10px] sm:text-sm md:text-base lg:text-xl -mt-0.5">{displaySuit}</div>
        </div>
      )}
    </div>
  );
};

export default CardComponent;