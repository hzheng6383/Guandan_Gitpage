import { Rank, Suit } from './types';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
  J: '★',
};

export const SUIT_COLORS: Record<Suit, string> = {
  H: 'text-red-600',
  D: 'text-red-600',
  C: 'text-slate-900',
  S: 'text-slate-900',
  J: 'text-purple-600', // Joker color, specific styling handles Red/Black joker
};

// Base values for sorting (2 is lowest in raw value, but in Guandan Level cards matter)
// We will use a standard sorting value map for display purposes
export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'BJ': 20, 'RJ': 21
};

export const AVATARS = {
  bottom: "https://picsum.photos/seed/user/100/100",
  right: "https://picsum.photos/seed/p2/100/100",
  top: "https://picsum.photos/seed/p3/100/100",
  left: "https://picsum.photos/seed/p4/100/100",
};