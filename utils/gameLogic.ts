import { Card, Rank, Suit, Player } from "../types";
import { RANK_VALUES } from "../constants";

// Helper to create a single deck
const createSingleDeck = (): Card[] => {
    const suits: Suit[] = ['H', 'D', 'C', 'S'];
    const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];

    suits.forEach(suit => {
        ranks.forEach(rank => {
            deck.push({
                id: `${suit}-${rank}-${Math.random().toString(36).substr(2, 9)}`,
                suit,
                rank,
                value: RANK_VALUES[rank]
            });
        });
    });

    deck.push({ id: `joker-small-${Math.random()}`, suit: 'J', rank: 'BJ', value: 20 });
    deck.push({ id: `joker-big-${Math.random()}`, suit: 'J', rank: 'RJ', value: 21 });

    return deck;
};

// Mapping from Level (2-14) to Rank String
const LEVEL_TO_RANK: Record<number, Rank> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

export const createDoubleDeck = (level: number): Card[] => {
    const deck1 = createSingleDeck();
    const deck2 = createSingleDeck();
    const fullDeck = [...deck1, ...deck2];

    // Find the rank string for the current level
    const rankStr = LEVEL_TO_RANK[level];

    fullDeck.forEach(card => {
        // Check if it matches current level rank
        if (rankStr && card.rank === rankStr) {
            card.isLevelCard = true;

            if (card.suit === 'H') {
                // Heart Level Card is Wild (Feng Ren Pei)
                card.isWild = true;
                card.value = 16; // Level cards are higher than A(14) but lower than Jokers
            } else {
                // Other Level Cards
                card.value = 15;
            }
        }
    });

    // Shuffle
    for (let i = fullDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
    }

    return fullDeck;
};

export const sortHand = (hand: Card[]): Card[] => {
    return [...hand].sort((a, b) => b.value - a.value);
};

// Analysis result type
export interface HandPattern {
    type: 'single' | 'pair' | 'triple' | 'fullhouse' | 'straight' | 'tube' | 'plate' | 'bomb' | 'kingbomb' | 'other' | 'empty';
    value: number; // The main value to compare
    count: number; // Total number of cards
    bombScore?: number; // Priority score for bombs
}

/**
 * Get the logical rank value of a card for sequence purposes.
 * Level cards return their face value (e.g., Level 5 card returns 5).
 * A returns 14 normally, but logic handles A->1 conversion separately.
 */
const getSequenceValue = (card: Card): number => {
    return RANK_VALUES[card.rank];
};

/**
 * Analyze the played cards to determine the pattern.
 */
export const analyzePattern = (cards: Card[]): HandPattern => {
    if (cards.length === 0) return { type: 'empty', value: 0, count: 0 };

    // Separate Wilds (Feng Ren Pei) and Normals
    const wilds = cards.filter(c => c.isWild);
    const normals = cards.filter(c => !c.isWild);
    const wildCount = wilds.length;

    // --- 1. King Bomb (Tian Zha) ---
    // 4 Kings (2 Red Jokers + 2 Black Jokers)
    if (cards.length === 4) {
        const rj = cards.filter(c => c.rank === 'RJ').length;
        const bj = cards.filter(c => c.rank === 'BJ').length;
        if (rj === 2 && bj === 2) {
            return { type: 'kingbomb', value: 999, count: 4, bombScore: 2000 };
        }
    }

    // --- 2. Pure Bomb Analysis (4+ Cards) ---
    // Check if normals are all same rank
    // Note: If normals is empty (all wilds), it's a bomb of the highest possible value (usually treated as A bomb or max)
    const isPureBomb = (() => {
        if (normals.length === 0) return true; // All wilds
        const firstVal = normals[0].value;
        return normals.every(c => c.value === firstVal);
    })();

    // Helper: Calculate standard bomb score
    // 4 Bomb: 400 + val
    // 5 Bomb: 500 + val
    // 6 Bomb: 600 + val
    // ...
    if (isPureBomb && cards.length >= 4) {
        let val = normals.length > 0 ? normals[0].value : 16; // Use Wild value if all wilds
        const baseScore = cards.length * 100;
        return { type: 'bomb', value: val, count: cards.length, bombScore: baseScore + val };
    }


    // --- 3. Straight Flush (Tong Hua Shun) ---
    // 5 cards, consecutive, same suit.
    if (cards.length === 5) {
        const normalSuits = new Set(normals.map(c => c.suit));
        if (normalSuits.size <= 1) { // 0 or 1 suit present
            // Check connectivity
            const seqVal = checkConsecutive(normals, wildCount, 5);
            if (seqVal !== -1) {
                // Straight Flush Rule: Beats 5 Bomb, Loses to 6 Bomb.
                // Score range: 550 + val.
                return { type: 'bomb', value: seqVal, count: 5, bombScore: 550 + seqVal };
            }
        }
    }

    // --- 4. Special Patterns (Non-Bomb) ---

    // Frequency Map for Normals
    const counts: Record<number, number> = {};
    normals.forEach(c => {
        const v = c.value;
        counts[v] = (counts[v] || 0) + 1;
    });
    const distinctVals = Object.keys(counts).map(Number).sort((a, b) => a - b);

    // Single
    if (cards.length === 1) {
        return { type: 'single', value: cards[0].value, count: 1 };
    }

    // Pair
    if (cards.length === 2) {
        // 1 normal + 1 wild OR 2 normals same val
        if (wildCount === 2 || (wildCount === 1) || (wildCount === 0 && distinctVals.length === 1)) {
            const val = normals.length > 0 ? normals[0].value : 16;
            return { type: 'pair', value: val, count: 2 };
        }
    }

    // Triple (Three of a kind) - Usually played as 3+2 in Guandan, but pure 3 might be allowed as lead?
    // Let's support pure 3 just in case, but usually it's Full House.
    if (cards.length === 3) {
        if (checkNGroup(counts, wildCount, 3)) {
            const val = normals.length > 0 ? normals[normals.length - 1].value : 16;
            return { type: 'triple', value: val, count: 3 };
        }
    }

    // Full House (San Dai Er / 3+2)
    if (cards.length === 5) {
        // Can we form 3 of A and 2 of B?
        // Logic: Try to make the highest possible triplet.
        for (let i = distinctVals.length - 1; i >= 0; i--) {
            const tripVal = distinctVals[i];
            const tripCount = counts[tripVal];
            const neededForTrip = Math.max(0, 3 - tripCount);

            if (wildCount >= neededForTrip) {
                return { type: 'fullhouse', value: tripVal, count: 5 };
            }
        }
        if (normals.length === 0 && wildCount === 5) return { type: 'fullhouse', value: 16, count: 5 };
    }

    // --- Sequence Based Patterns (Straight, Tube, Plate) ---
    const seqNormals = normals.map(c => ({ ...c, seqVal: getSequenceValue(c) }));

    // Straight (Shun Zi) - 5 cards
    if (cards.length === 5) {
        const seqVal = checkConsecutive(seqNormals.map(c => ({ value: c.seqVal })), wildCount, 5);
        if (seqVal !== -1) {
            return { type: 'straight', value: seqVal, count: 5 };
        }
    }

    // Tube (Lian Dui / 3 Consecutive Pairs) - 6 cards (e.g. 334455)
    if (cards.length === 6) {
        const tubeVal = checkConsecutiveGroup(seqNormals, wildCount, 3, 2); // 3 groups of 2
        if (tubeVal !== -1) {
            return { type: 'tube', value: tubeVal, count: 6 };
        }
    }

    // Steel Plate (Gang Ban / 2 Consecutive Triples) - 6 cards (e.g. 333444)
    if (cards.length === 6) {
        const plateVal = checkConsecutiveGroup(seqNormals, wildCount, 2, 3); // 2 groups of 3
        if (plateVal !== -1) {
            return { type: 'plate', value: plateVal, count: 6 };
        }
    }

    return { type: 'other', value: 0, count: cards.length };
};

// --- Helper Functions ---

const checkConsecutive = (cards: { value: number }[], wildCount: number, targetLen: number): number => {
    const uniqueVals = Array.from(new Set(cards.map(c => c.value))).sort((a, b) => a - b);
    if (uniqueVals.length !== cards.length) return -1;
    if (uniqueVals.length === 0) return 14;

    // Try Standard Sequence (A is 14)
    const maxVal = uniqueVals[uniqueVals.length - 1];
    const minVal = uniqueVals[0];
    if (maxVal <= 14) {
        const span = maxVal - minVal + 1;
        if (span <= targetLen) {
            const neededTotal = targetLen - uniqueVals.length;
            if (wildCount >= neededTotal) {
                let top = maxVal;
                let remainingWilds = wildCount - (span - uniqueVals.length);
                while (remainingWilds > 0 && top < 14) {
                    top++;
                    remainingWilds--;
                }
                return top;
            }
        }
    }
    // Try A as 1
    if (uniqueVals.includes(14)) {
        const lowVals = uniqueVals.map(v => v === 14 ? 1 : v).sort((a, b) => a - b);
        const maxL = lowVals[lowVals.length - 1];
        const minL = lowVals[0];
        const span = maxL - minL + 1;
        if (span <= targetLen) {
            const neededTotal = targetLen - uniqueVals.length;
            if (wildCount >= neededTotal) {
                return minL + targetLen - 1;
            }
        }
    }
    return -1;
};

const checkConsecutiveGroup = (cards: { seqVal: number }[], wildCount: number, groupCount: number, groupSize: number): number => {
    const counts: Record<number, number> = {};
    cards.forEach(c => {
        counts[c.seqVal] = (counts[c.seqVal] || 0) + 1;
    });

    // Simple window check
    for (let start = 2; start <= 14 - groupCount + 1; start++) {
        let neededWilds = 0;
        let matchedNormals = 0;

        for (let i = 0; i < groupCount; i++) {
            const rank = start + i;
            const have = counts[rank] || 0;
            if (have > groupSize) {
                neededWilds = 999;
                break;
            }
            neededWilds += (groupSize - have);
            matchedNormals += have;
        }

        if (matchedNormals === cards.length && wildCount === neededWilds) {
            return start + groupCount - 1;
        }
    }

    // Check A-2-3 (A=1)
    if (counts[14]) {
        counts[1] = counts[14];
        let neededWilds = 0;
        let matchedNormals = 0;
        for (let i = 0; i < groupCount; i++) {
            const rank = 1 + i;
            const have = counts[rank] || 0;
            if (have > groupSize) { neededWilds = 999; break; }
            neededWilds += (groupSize - have);
            matchedNormals += have;
        }
        if (wildCount === neededWilds) {
            let windowCardCount = 0;
            for (let i = 0; i < groupCount; i++) windowCardCount += (counts[1 + i] || 0);
            if (windowCardCount === cards.length) {
                return groupCount;
            }
        }
    }
    return -1;
};

const checkNGroup = (counts: Record<number, number>, wildCount: number, n: number): boolean => {
    const vals = Object.keys(counts).map(Number);
    if (vals.length === 0) return true;
    if (vals.length > 1) return false;

    const count = counts[vals[0]];
    return (count + wildCount) >= n;
};

// --- Public Validation ---

export const isValidMove = (selected: Card[], lastPlayed: Card[]): boolean => {
    if (selected.length === 0) return false;

    const selPattern = analyzePattern(selected);
    if (selPattern.type === 'other' || selPattern.type === 'empty') return false;

    // Free play
    if (lastPlayed.length === 0) return true;

    const lastPattern = analyzePattern(lastPlayed);

    // 1. King Bomb
    if (selPattern.type === 'kingbomb') return true;
    if (lastPattern.type === 'kingbomb') return false;

    // 2. Bomb Comparisons
    if (selPattern.type === 'bomb') {
        if (lastPattern.type !== 'bomb') return true;
        const sScore = selPattern.bombScore || 0;
        const lScore = lastPattern.bombScore || 0;
        if (sScore === lScore) return selPattern.value > lastPattern.value;
        return sScore > lScore;
    }

    if (lastPattern.type === 'bomb') return false;

    // 3. Normal Pattern Matching
    if (selPattern.type !== lastPattern.type) return false;
    if (selPattern.count !== lastPattern.count) return false;

    return selPattern.value > lastPattern.value;
};

export const findSpade3 = (players: { id: string, hand: Card[] }[]): number => {
    for (let i = 0; i < players.length; i++) {
        if (players[i].hand.some(c => c.suit === 'S' && c.rank === '3')) {
            return i;
        }
    }
    return 0;
};

// --- AI INTELLIGENCE ---

// Group cards by value to find Pairs, Triples, Bombs
const groupHand = (hand: Card[]): {
    singles: Card[][],
    pairs: Card[][],
    triples: Card[][],
    bombs: Card[][],
    levelCards: Card[], // Level cards (usually value 15)
    jokers: Card[]
} => {
    const groups: Record<number, Card[]> = {};
    const wilds: Card[] = [];
    const jokers: Card[] = [];

    hand.forEach(c => {
        if (c.isWild) wilds.push(c);
        else if (c.rank === 'BJ' || c.rank === 'RJ') jokers.push(c);
        else {
            if (!groups[c.value]) groups[c.value] = [];
            groups[c.value].push(c);
        }
    });

    const result = {
        singles: [] as Card[][],
        pairs: [] as Card[][],
        triples: [] as Card[][],
        bombs: [] as Card[][],
        levelCards: [] as Card[],
        jokers: jokers
    };

    // Sort groups by value
    const sortedValues = Object.keys(groups).map(Number).sort((a, b) => a - b);

    sortedValues.forEach(val => {
        const cards = groups[val];
        if (cards.length >= 4) result.bombs.push(cards);
        else if (cards.length === 3) result.triples.push(cards);
        else if (cards.length === 2) result.pairs.push(cards);
        else result.singles.push(cards);

        // Identify pure level cards (non-wild)
        if (cards[0].isLevelCard && !cards[0].isWild) {
            result.levelCards.push(...cards);
        }
    });

    return result;
};

const isTeammate = (p1Id: string, p2Id: string, players: Player[]): boolean => {
    const p1 = players.find(p => p.id === p1Id);
    const p2 = players.find(p => p.id === p2Id);
    return !!p1 && !!p2 && p1.team === p2.team;
};

/**
 * Finds the best move for AI.
 * Now improved with "Global Consideration" (Guandan Strategy).
 */
export const findBestMove = (
    hand: Card[],
    lastPlayed: Card[],
    lastPlayedBy: string | null,
    players: Player[],
    myIndex: number
): Card[] | null => {
    const sortedHand = sortHand(hand);
    const groups = groupHand(hand);

    if (lastPlayed.length === 0) {
        return getBestLead(groups, sortedHand);
    } else {
        return getBestCounter(groups, sortedHand, lastPlayed, lastPlayedBy, players, myIndex);
    }
};

const getBestLead = (groups: ReturnType<typeof groupHand>, fullHand: Card[]): Card[] | null => {
    // Guandan Strategy:
    // 1. Play difficult patterns (Straights/Tubes) if possible (Not fully implemented in grouping yet, simplified here)
    // 2. Clear small hands (small pairs, small triples)
    // 3. Play Straight/Tube/Plate if we have them to force bombs or pass
    // 4. Save bombs unless necessary

    // Simplification: Try to lead Triple+2 (Full House) first as it burns 5 cards and is strong
    if (groups.triples.length > 0) {
        const triple = groups.triples[0];
        // Try to find a small pair to attach
        if (groups.pairs.length > 0) {
            return [...triple, ...groups.pairs[0]];
        }
        // If no pair, play pure triple if allowed, or hold if not. 
        // In Guandan, pure 3 is valid.
        return triple;
    }

    // Try Pair
    if (groups.pairs.length > 0) {
        return groups.pairs[0];
    }

    // Try Single (smallest)
    if (groups.singles.length > 0) {
        // Try not to break Level Cards or Jokers if possible
        const smallSingles = groups.singles.filter(c => c[0].value < 15);
        if (smallSingles.length > 0) return smallSingles[0];
        return groups.singles[0];
    }

    // Only bombs left
    if (groups.bombs.length > 0) return groups.bombs[0];

    // Jokers/Level Cards left as singles
    if (fullHand.length > 0) return [fullHand[fullHand.length - 1]];

    return null;
};

const getBestCounter = (
    groups: ReturnType<typeof groupHand>,
    fullHand: Card[],
    lastPlayed: Card[],
    lastPlayedBy: string | null,
    players: Player[],
    myIndex: number
): Card[] | null => {
    const lastPattern = analyzePattern(lastPlayed);
    const myPlayer = players[myIndex];
    const teammate = players.find(p => p.team === myPlayer.team && p.id !== myPlayer.id);
    const isPartnerPlayed = !!(lastPlayedBy && teammate && lastPlayedBy === teammate.id);

    // Find Next Player (Opponent) Hand Count
    const nextPlayerIndex = (myIndex + 1) % 4;
    const nextPlayer = players[nextPlayerIndex];
    const isNextEnemy = nextPlayer.team !== myPlayer.team;
    const nextEnemyLowCards = isNextEnemy && nextPlayer.hand.length <= 5; // Alert if enemy has few cards

    // --- STRATEGY 0: FINISHER LOGIC (NEW) ---
    // If I only have 1 card left (e.g. RJ), and opponent played single, I MUST play.
    if (fullHand.length === 1 && !isPartnerPlayed && lastPattern.type === 'single') {
        if (fullHand[0].value > lastPattern.value) {
            return fullHand; // GO OUT!
        }
    }

    // --- STRATEGY 1: PARTNER PLAYED ---
    if (isPartnerPlayed) {
        // Partner played a Bomb? Pass.
        if (lastPattern.type === 'bomb' || lastPattern.type === 'kingbomb') return null;

        // Partner played High Card (A, Level, Joker)? Pass.
        if (lastPattern.value >= 14) return null;

        // Partner played "Okay" card (10, J, Q, K)?
        // Pass unless I have a lot of cards and need to clear junk.
        if (lastPattern.value >= 10) return null;

        // Partner played small? They want me to take the lead ("Jie Feng")?
        // If I have a very strong hand, beat it. If I have a small hand, let it go.
        // Default: Beat small cards (<10) to protect partner from being beaten by next opponent cheap.
    }

    // --- STRATEGY 2: ENEMY PLAYED ---
    if (!isPartnerPlayed) {
        // "Ding Jia" (Block Upstream): If I am Upstream to an enemy (I sit before them), and they have few cards,
        // I must play BIG to block them.
        if (nextEnemyLowCards) {
            // Try to play my biggest possible matching card (e.g. A, Joker) instead of just "one higher"
            // This is complex, for now we just force a beat if possible.
        }
    }

    // --- EXECUTE FIND MATCH ---

    // 1. Single
    if (lastPattern.type === 'single') {
        let candidates = [...groups.singles];

        // BUG FIX: Jokers and Level Cards were separated in groupHand but need to be candidates for single plays
        // Add Jokers as potential single candidates
        groups.jokers.forEach(j => candidates.push([j]));
        // Add Level Cards as potential single candidates (if not already in singles)
        groups.levelCards.forEach(l => {
            // Check if it's already in singles (groupHand puts them in singles if they are indeed singles)
            // But if we have 2 level cards, groupHand puts them in pairs. We might want to break them if desperate.
            // For now, let's just rely on what groupHand categorized as single to avoid breaking pairs too easily,
            // UNLESS we are in "Finisher" mode or "Ding Jia" mode.
        });

        // Sort candidates by value
        candidates.sort((a, b) => a[0].value - b[0].value);

        // Filter candidates > lastValue
        candidates = candidates.filter(c => c[0].value > lastPattern.value);

        if (candidates.length === 0) {
            // Check Bombs if necessary
            if (shouldUseBomb(lastPattern, groups, isPartnerPlayed, nextEnemyLowCards)) {
                return groups.bombs[0];
            }
            return null;
        }

        // Logic: Which single to pick?
        // If Enemy played low, and Next Enemy is Low Cards -> Play Big (A/Joker)
        // If Partner played low -> Play Medium (10-K)
        // Default -> Play Smallest winning

        if (nextEnemyLowCards && !isPartnerPlayed) {
            // Play biggest
            return candidates[candidates.length - 1];
        }

        return candidates[0]; // Smallest winning
    }

    // 2. Pair
    if (lastPattern.type === 'pair') {
        const candidates = groups.pairs.filter(p => p[0].value > lastPattern.value);
        if (candidates.length > 0) {
            if (nextEnemyLowCards && !isPartnerPlayed) return candidates[candidates.length - 1];
            return candidates[0];
        }
        if (shouldUseBomb(lastPattern, groups, isPartnerPlayed, nextEnemyLowCards)) return groups.bombs[0];
    }

    // 3. Triple
    if (lastPattern.type === 'triple') {
        const candidates = groups.triples.filter(t => t[0].value > lastPattern.value);
        if (candidates.length > 0) return candidates[0];
        if (shouldUseBomb(lastPattern, groups, isPartnerPlayed, nextEnemyLowCards)) return groups.bombs[0];
    }

    // 4. Full House
    if (lastPattern.type === 'fullhouse') {
        const candidates = groups.triples.filter(t => t[0].value > lastPattern.value);
        if (candidates.length > 0) {
            // Need a pair
            if (groups.pairs.length > 0) return [...candidates[0], ...groups.pairs[0]];
            // Or another triple (using 2)
            if (groups.triples.length > 1) {
                // Find a triple that isn't the one we are using for the 3-part
                const pairTrip = groups.triples.find(t => t[0].value !== candidates[0][0].value);
                if (pairTrip) return [...candidates[0], pairTrip[0], pairTrip[1]];
            }
        }
        if (shouldUseBomb(lastPattern, groups, isPartnerPlayed, nextEnemyLowCards)) return groups.bombs[0];
    }

    // 5. Bomb Defense
    if (groups.bombs.length > 0 && !isPartnerPlayed) {
        if (lastPattern.type === 'bomb') {
            // Must beat it
            const lScore = lastPattern.bombScore || 0;
            for (const b of groups.bombs) {
                const val = b[0].value;
                const myScore = b.length * 100 + val;
                if (myScore > lScore) return b;
            }
        }
        // If pattern is KingBomb, can't beat
    }

    return null;
};

// Helper: When to Bomb?
const shouldUseBomb = (
    lastPattern: HandPattern,
    groups: ReturnType<typeof groupHand>,
    isPartnerPlayed: boolean | undefined,
    nextEnemyLowCards: boolean
): boolean => {
    if (groups.bombs.length === 0) return false;
    if (isPartnerPlayed) return false; // Don't bomb partner
    if (lastPattern.type === 'bomb' || lastPattern.type === 'kingbomb') return false; // Handled in main logic

    // Bomb if:
    // 1. Enemy is about to win (nextEnemyLowCards)
    // 2. The played card is very high (A, Level, Joker) and we want to control
    // 3. We have many bombs (e.g. > 2)

    if (nextEnemyLowCards) return true;
    if (lastPattern.value >= 14) return true; // Block Aces/Jokers
    if (groups.bombs.length >= 3) return true; // Aggressive

    return false;
};

/**
 * Smart Sorts the hand by finding patterns (Bombs > Triples > Pairs > Singles).
 * Wilds (Level Cards / Hearts) are put at the front.
 */
export const smartSortHand = (hand: Card[]): Card[] => {
    // 1. Separate Wilds (Feng Ren Pei) - Keep them at top
    // Note: In groupHand, we might have separated them, but here we want strict visual order.
    // Logic: 
    // - King Bomb (4 Jokers) -> Highest Priority
    // - Wilds (Heart Level Cards) -> High Priority
    // - Bombs (4+) -> High
    // - Triples (3) -> Mid
    // - Pairs (2) -> Low
    // - Singles -> Lowest
    // - Remaining Jokers (if not in King Bomb) -> With Singles/Pairs? usually Singles.

    const groups = groupHand(hand);
    let sorted: Card[] = [];

    // 1. King Bomb (4 Jokers)
    // Check if we have 2 Red and 2 Black jokers in the hand (not just in groups.jokers)
    const rj = hand.filter(c => c.rank === 'RJ');
    const bj = hand.filter(c => c.rank === 'BJ');
    if (rj.length === 2 && bj.length === 2) {
        sorted.push(...rj, ...bj);
        // Remove them from groups to avoid dupes? 
        // groupHand puts them in 'jokers'.
    }

    // To avoid complexity with removing from groups, let's just rebuild the list from the groups structure
    // but we need to be careful about the King Bomb case which consumes all jokers.

    // Simpler approach: Use the groups directly, but handle Jokers specifically.
    const hasKingBomb = (rj.length === 2 && bj.length === 2);

    // 2. Wilds (Level Cards that are Hearts)
    // In groupHand, these are in `wilds` (internal variable) but not returned explicitly as a separate list in interface 
    // wait, groupHand implementation in file:
    // const results = { singles, pairs, triples, bombs, levelCards, jokers }
    // It does NOT export 'wilds'. pattern: 'levelCards' contains pure level cards (non-wild).
    // checking groupHand code:
    // if (c.isWild) wilds.push(c) -> but wilds is NOT in result object! 
    // The `wilds` array in `groupHand` is defined but seemingly lost?
    // Let's re-read groupHand in the tool output from step 52.
    // Lines 378-417.
    // It creates `wilds` array (line 379), populates it (line 383).
    // But the return object `result` (lines 391-398) DOES NOT include `wilds`.
    // AND `wilds` are NOT added to groups! (line 383 is `if ... else if ... else ...`)
    // So Wild cards are completely MISSING from `groupHand` return value!

    // FIX: logic in `groupHand` seems to drop wilds from the return. 
    // However, I cannot easily change `groupHand` without touching the middle of the file.
    // I will write intrinsic logic in `smartSortHand` to handle this safely without relying on `groupHand` for wilds.

    const level = hand.length > 0 && hand[0].isLevelCard ? parseInt(hand[0].rank) || 2 : 2; // Approximate level? 
    // Actually we don't need level number if isWild property is set.

    const _wilds = hand.filter(c => c.isWild).sort((a, b) => b.suit.localeCompare(a.suit)); // Sort wilds by suit? or just keep them.
    const _jokers = hand.filter(c => c.rank === 'BJ' || c.rank === 'RJ').sort((a, b) => b.value - a.value);
    const _normals = hand.filter(c => !c.isWild && c.rank !== 'BJ' && c.rank !== 'RJ');

    // Group Normals
    const _normalGroups = groupHand(_normals);
    // groupHand handles normals fine.

    // Build Output
    // 1. King Bomb (if 4 jokers)
    if (_jokers.length === 4) {
        sorted.push(..._jokers);
    }

    // 2. Wilds
    sorted.push(..._wilds);

    // 3. Bombs (Sort by value desc)
    // _normalGroups.bombs is sorted by value ascending in groupHand?
    // "sortedValues" in groupHand is a-b (Ascending). 
    // We want Descending for display usually? Or Ascending? 
    // Default sortHand is Descending (b.value - a.value).
    // Let's keep Descending for Smart Sort too (Big bombs first).
    [..._normalGroups.bombs].reverse().forEach(b => sorted.push(...b));

    // 4. Triples
    [..._normalGroups.triples].reverse().forEach(t => sorted.push(...t));

    // 5. Pairs
    [..._normalGroups.pairs].reverse().forEach(p => sorted.push(...p));

    // 6. Singles
    [..._normalGroups.singles].reverse().forEach(s => sorted.push(...s));

    // 7. Remaining Jokers (if not King Bomb)
    if (_jokers.length < 4) {
        sorted.push(..._jokers);
    }

    // 8. Level Cards (Pure) - groupHand puts them in singles/pairs/etc. 
    // But `groupHand` puts "pure level cards" into `levelCards` array AND `groups`?
    // Let's check groupHand logic:
    // "if (!groups[c.value]) groups[c.value] = []; groups[c.value].push(c);"
    // "if (c.asLevelCard && !c.isWild) result.levelCards.push(...cards)"
    // So they ARE in singles/pairs/etc.

    // Wait, separate check:
    // If I have 3 Level Cards (Rank 2), groupHand sees value 15.
    // It creates a group key 15 with 3 cards.
    // Then it pushes to `triples`.
    // So they are already included in Triples/Pairs/Singles above.

    return sorted;
};

/**
 * Advanced Heuristic Factorization for Guandan Hand
 * Strategically extracts patterns in order of priority:
 * 1. King Bomb (4 Jokers)
 * 2. Bombs (4+ cards of same rank)
 * 3. Steel Plates (2 Consecutive Triples)
 * 4. Tubes (3 Consecutive Pairs)
 * 5. Full Houses (Triple + Pair) - Note: In Guandan, pure triples are often rare, usually played as 3+2
 * 6. Straights (5 consecutive cards)
 * 7. Remainder (Triples, Pairs, Singles)
 */
export const groupHandForDisplay = (hand: Card[]): Card[][] => {
    let workingSet = [...hand]; // Clone to modify
    const displayGroups: Card[][] = [];

    // Helper to remove cards from working set
    const extractCards = (cardsToRemove: Card[]) => {
        const idsToRemove = new Set(cardsToRemove.map(c => c.id));
        workingSet = workingSet.filter(c => !idsToRemove.has(c.id));
        return cardsToRemove;
    };

    // Helper to get grouped structure of current working set
    const refreshGroups = () => groupHand(workingSet);

    // --- 0. PRE-SORT: Group ALL Jokers together ---
    const jokers = workingSet.filter(c => c.rank === 'RJ' || c.rank === 'BJ');
    if (jokers.length > 0) {
        // Sort jokers: RJ first then BJ (Big to Small usually? RJ=Big Joker, BJ=Small Joker? No, usually Red is Big in China? 
        // In this app: rj (Red) > bj (Black). 
        // Logic check: RJ is Red (Big), BJ is Black (Small).
        jokers.sort((a, b) => b.value - a.value);
        displayGroups.push(extractCards(jokers));
    }

    // --- 0.5. PRE-SORT: Group ALL Level Cards (Main Cards) together ---
    // Includes Heart Level Cards and Non-Heart Level Cards
    const levelCards = workingSet.filter(c => c.isLevelCard);
    if (levelCards.length > 0) {
        // Sort level cards: Heart (Wild) first, then others by suit?
        // Usually Wilds (Hearts) are most important. 
        // Sort: Wilds first, then others.
        levelCards.sort((a, b) => {
            if (a.isWild && !b.isWild) return -1;
            if (!a.isWild && b.isWild) return 1;
            return b.suit.localeCompare(a.suit); // Group by suit for non-wilds
        });
        displayGroups.push(extractCards(levelCards));
    }


    // --- 1. King Bomb (Functionally handled above, but keeping logic structure consistent if we wanted specific grouping) ---
    // Since we extracted ALL jokers, King Bomb is already inside the Joker group.

    // --- 2. Bombs (4+ cards of same rank) ---
    // We only look for bombs in the remaining cards (non-Level, non-Joker)
    let groups = refreshGroups();
    // Sort bombs largely on value (desc)
    [...groups.bombs].sort((a, b) => b[0].value - a[0].value).forEach(bomb => {
        displayGroups.push(extractCards(bomb));
    });

    // --- 3. Steel Plates (Consecutive Triples) ---
    groups = refreshGroups();
    let triples = [...groups.triples].sort((a, b) => a[0].value - b[0].value);
    const usedTripleIndices = new Set<number>();

    for (let i = 0; i < triples.length - 1; i++) {
        if (usedTripleIndices.has(i)) continue;

        const t1 = triples[i];
        const t2 = triples[i + 1];

        // Strict value adjacency
        if (t2[0].value === t1[0].value + 1) {
            displayGroups.push(extractCards([...t1, ...t2]));
            usedTripleIndices.add(i);
            usedTripleIndices.add(i + 1);
            i++;
        }
    }

    // --- 4. Tubes (Consecutive Pairs - 3 pairs minimum) ---
    groups = refreshGroups();
    let pairs = [...groups.pairs].sort((a, b) => a[0].value - b[0].value);
    const usedPairIndices = new Set<number>();

    for (let i = 0; i < pairs.length - 2; i++) {
        if (usedPairIndices.has(i)) continue;

        const p1 = pairs[i];
        const p2 = pairs[i + 1];
        const p3 = pairs[i + 2];

        if (p2[0].value === p1[0].value + 1 && p3[0].value === p2[0].value + 1) {
            displayGroups.push(extractCards([...p1, ...p2, ...p3]));
            usedPairIndices.add(i);
            usedPairIndices.add(i + 1);
            usedPairIndices.add(i + 2);
            i += 2;
        }
    }

    // --- 5. Straights (5 consecutive singles) ---
    // User requested straights also be grouped.
    groups = refreshGroups();
    const singles = [...groups.singles].sort((a, b) => a[0].value - b[0].value);
    const usedSingleIndices = new Set<number>();

    for (let i = 0; i <= singles.length - 5; i++) {
        if (usedSingleIndices.has(i)) continue;

        // check for sequence of 5
        let sequence: Card[] = [...singles[i]];
        let k = 1;
        let isStraight = true;
        let currentIndices = [i];

        while (k < 5) { // Guandan straight is 5 cards. Can be more? Usually just 5 for basic pattern matching? Or arbitrary length? 
            // Guandan rules often allow 5 consecutive. Let's aim for 5 first.
            if (i + k >= singles.length) { isStraight = false; break; }
            const nextCard = singles[i + k][0];
            const prevCard = sequence[sequence.length - 1]; // Single is array of 1 card

            if (usedSingleIndices.has(i + k) || nextCard.value !== prevCard.value + 1) {
                isStraight = false;
                break;
            }
            sequence.push(nextCard);
            currentIndices.push(i + k);
            k++;
        }

        if (isStraight) {
            displayGroups.push(extractCards(sequence));
            currentIndices.forEach(idx => usedSingleIndices.add(idx));
            i += 4; // Skip ahead
        }
    }

    // --- 6. Full Houses (Triple + Pair) ---
    groups = refreshGroups();
    triples = [...groups.triples].sort((a, b) => a[0].value - b[0].value); // Small triples first (to match small pairs)
    pairs = [...groups.pairs].sort((a, b) => a[0].value - b[0].value); // Small pairs first (use them as kicker)

    triples.forEach(t => {
        // Check if triple is still in working set (might have been used if we had conflicting logic, though here it's fresh)
        if (workingSet.find(c => c.id === t[0].id)) {
            // Find smallest available pair
            const validPair = pairs.find(p => workingSet.some(wc => wc.id === p[0].id));
            if (validPair) {
                displayGroups.push(extractCards([...t, ...validPair]));
                // We don't need to manually remove from 'pairs' array for logic correctness because 'extractCards' updates 'workingSet', 
                // and the check 'workingSet.some' handles validity. But for efficiency/correctness of next iteration finding the *next* smallest:
                pairs = pairs.filter(p => p !== validPair);
            }
        }
    });

    // --- 7. Remainder ---
    groups = refreshGroups();

    // Remaining Triples
    [...groups.triples].reverse().forEach(t => displayGroups.push(extractCards(t)));
    // Remaining Pairs
    [...groups.pairs].reverse().forEach(p => displayGroups.push(extractCards(p)));
    // Remaining Singles (including any leftovers)
    [...groups.singles].reverse().forEach(s => displayGroups.push(extractCards(s)));

    // There should be no Jokers/Level Cards left here as they were extracted first.

    return displayGroups;
};