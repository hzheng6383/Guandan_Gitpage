export type Suit = 'H' | 'D' | 'C' | 'S' | 'J'; // Hearts, Diamonds, Clubs, Spades, Joker
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'BJ' | 'RJ';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number; // For sorting and comparison
  isLevelCard?: boolean; // If it matches the current game level
  isWild?: boolean; // If it is the Heart Level Card (Feng Ren Pei)
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isCpu: boolean;
  position: 'bottom' | 'left' | 'right' | 'top';
  role: 'host' | 'guest'; 
  team: 1 | 2;
  lastAction: 'play' | 'pass' | null; // Visual indicator for the last move
  finishedRank: number | null; // 1 (Upstream), 2 (2nd), 3 (3rd), 4 (Downstream)
  isManual?: boolean; // If true, human controls this CPU
}

export type GamePhase = 'lobby' | 'playing' | 'gameover' | 'tribute';

export interface MoveRecord {
  player: string;
  action: 'play' | 'pass';
  cards?: Card[];
  timestamp: number;
}

export interface TableStateItem {
  action: 'play' | 'pass';
  cards?: Card[];
}

export interface GameState {
  currentLevel: number; 
  players: Player[];
  currentPlayerIndex: number;
  lastPlayedCards: Card[]; // The specific set of cards that needs to be beaten
  lastPlayedBy: string | null;
  phase: GamePhase;
  deck: Card[];
  message: string;
  history: MoveRecord[];
  isRoundPause: boolean; // Pause state between tricks
  rankings: string[]; // Array of player IDs in order of finishing
  consecutivePasses: number; // Track passes to end round strictly
  tableState: Record<string, TableStateItem>; // Visual state of cards on the table for each player
}

export interface TributePending {
  fromId: string;
  toId: string;
  type: 'MAX' | 'RETURN';
}