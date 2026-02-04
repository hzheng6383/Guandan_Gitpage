
import { App as CapacitorApp } from '@capacitor/app';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, GameState, Player, MoveRecord, TributePending } from './types';
import { createDoubleDeck, sortHand, isValidMove, findBestMove, findSpade3, smartSortHand, groupHandForDisplay } from './utils/gameLogic';
import { playActionSound } from './utils/soundUtils';
import CardComponent from './components/CardComponent';
import PlayerAvatar from './components/PlayerAvatar';
import GameLogo from './components/GameLogo';
import { SUIT_SYMBOLS } from './constants';
import { Play, RotateCcw, Trophy, ScrollText, X, Clock, Crown, TrendingUp, ChevronLeft, ChevronRight, Gift, Eye, EyeOff, MousePointer2, ShoppingCart, Gem, Coins, Zap, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { initializeAdMob, showRewardVideoAd } from './services/admobService';

const INITIAL_LEVEL = 2;
const MAX_LEVEL = 14; // Ace

// Helper for Rank String
const getRankStr = (level: number) => {
    if (level <= 10) return level.toString();
    if (level === 11) return 'J';
    if (level === 12) return 'Q';
    if (level === 13) return 'K';
    if (level === 14) return 'A';
    return level.toString();
};

const App: React.FC = () => {
    console.log("App Component Rendering...");
    // Persistent Game State (across matches)
    const [teamLevels, setTeamLevels] = useState<{ 1: number, 2: number }>({ 1: INITIAL_LEVEL, 2: INITIAL_LEVEL });
    const [activeTeam, setActiveTeam] = useState<1 | 2>(1); // Team 1 starts as host
    const [lastWinnerId, setLastWinnerId] = useState<string | null>(null); // Track who won the previous game to start next
    const [lastRankings, setLastRankings] = useState<string[]>([]); // To calculate tribute
    const [isFirstGame, setIsFirstGame] = useState(true);

    // User Currency State (Example)
    const [userCoins, setUserCoins] = useState(5000);
    const [isLoadingAd, setIsLoadingAd] = useState(false);
    const [isSoundOn, setIsSoundOn] = useState(true); // Sound Toggle


    const [gameState, setGameState] = useState<GameState>({
        currentLevel: INITIAL_LEVEL,
        players: [],
        currentPlayerIndex: 0,
        lastPlayedCards: [], // Logic State:current strongest cards to beat
        lastPlayedBy: null,
        phase: 'lobby',
        deck: [],
        message: '',
        history: [],
        isRoundPause: false,
        rankings: [],
        consecutivePasses: 0,
        tableState: {} // Visual State:what is shown on the table for each player
    });

    const [tributeQueue, setTributeQueue] = useState<TributePending[]>([]);
    const [currentTribute, setCurrentTribute] = useState<TributePending | null>(null);

    // New state to show what card was received
    const [receivedTribute, setReceivedTribute] = useState<{ card: Card, fromName: string } | null>(null);

    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
    const [showHistory, setShowHistory] = useState(false);
    const [showShop, setShowShop] = useState(false); // Shop Modal State
    const [isOpenHand, setIsOpenHand] = useState(false); // God mode:see all cards
    const [isSmartSort, setIsSmartSort] = useState(true); // Smart Sort Toggle

    // Touch Detection State
    const touchedCardId = useRef<string | null>(null);
    const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
    const isDragging = useRef(false);
    const dragStartPos = useRef({ x: -999, y: -999 });
    const dragSelectionState = useRef<boolean | null>(null);
    const touchedCardIds = useRef<Set<string>>(new Set());

    // Game Result State for Modal
    const [gameResult, setGameResult] = useState<{
        winnerTeam: 1 | 2;
        increment: number;
        newLevel: number;
        description: string;
        nextStarterName: string;
    } | null>(null);

    // Scroll ref for history
    const historyEndRef = useRef<HTMLDivElement>(null);
    const miniHandRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const handScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize AdMob when app starts
        initializeAdMob();

        // Android Back Button Handling
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            CapacitorApp.exitApp();
        });
    }, []);

    useEffect(() => {
        if (showHistory && historyEndRef.current) {
            historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [showHistory, gameState.history]);

    // Auto-center the hand scroll view when layout changes (e.g. Smart Sort)
    useEffect(() => {
        if (handScrollRef.current) {
            const el = handScrollRef.current;
            // Center the scroll: (Total Width - Viewport Width) / 2
            el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
        }
    }, [isSmartSort, gameState.players]);

    // Determine the current target player for controls (User or Manual CPU)
    const activePlayerForEffect = gameState.players[gameState.currentPlayerIndex];
    const userPlayerForEffect = gameState.players[0];
    const playerControlTargetForEffect = (activePlayerForEffect?.isManual) ? activePlayerForEffect : userPlayerForEffect;

    // Reset selection when switching controlled players
    useEffect(() => {
        if (playerControlTargetForEffect?.id) {
            setSelectedCardIds(new Set());
        }
    }, [playerControlTargetForEffect?.id]);

    // STRICT RESET:Reset selection whenever it becomes the user's turn to play
    useEffect(() => {
        if (activePlayerForEffect?.id === 'p1' && !activePlayerForEffect?.isCpu) {
            setSelectedCardIds(new Set());
        }
    }, [gameState.currentPlayerIndex]);

    const calculateGameResult = useCallback(() => {
        const { rankings, players } = gameState;
        if (rankings.length === 0) return;

        // 1. Identify Winner (1st Place)
        const winnerId = rankings[0];
        const winner = players.find(p => p.id === winnerId);
        if (!winner) return;

        // Fix:Ensure rankings has all 4 players for next game Tribute Logic
        let finalRankings = [...rankings];
        if (finalRankings.length < 4) {
            const rankedSet = new Set(finalRankings);
            const unranked = players.filter(p => !rankedSet.has(p.id));
            unranked.forEach(p => finalRankings.push(p.id));
        }

        setLastWinnerId(winnerId);
        setLastRankings(finalRankings);

        const winningTeam = winner.team;
        const losingTeam = winningTeam === 1 ? 2 : 1;

        let rawIncrement = 0;
        let baseDescription = "";
        let loserDrop = 0;

        const secondPlaceId = rankings[1];
        const secondPlace = players.find(p => p.id === secondPlaceId);

        if (secondPlace && secondPlace.team === winningTeam) {
            rawIncrement = 3;
            baseDescription = "双上！(头游+二游)";
            loserDrop = 2;
        } else {
            const thirdPlaceId = rankings[2];
            const thirdPlace = players.find(p => p.id === thirdPlaceId);

            if (thirdPlace && thirdPlace.team === winningTeam) {
                rawIncrement = 2;
                baseDescription = "单上！(头游+三游)";
            } else {
                rawIncrement = 1;
                baseDescription = "平上！(头游+末游)";
            }
        }

        const currentTeamLevel = teamLevels[winningTeam];
        let finalIncrement = rawIncrement;
        let nextLevel = currentTeamLevel;
        let description = baseDescription;

        if (currentTeamLevel === MAX_LEVEL) {
            if (rawIncrement === 3) {
                description += "-恭喜！打过A级，获得最终胜利！";
                nextLevel = 2;
                setTeamLevels({ 1: 2, 2: 2 });
            } else {
                finalIncrement = 0;
                nextLevel = MAX_LEVEL;
                description += "-(打A必须双上才能过级，级数不变)";
            }
        } else {
            nextLevel = currentTeamLevel + rawIncrement;
            if (nextLevel > MAX_LEVEL) nextLevel = MAX_LEVEL;
        }

        if (!(currentTeamLevel === MAX_LEVEL && rawIncrement === 3)) {
            setTeamLevels(prev => {
                const loserLevel = prev[losingTeam];
                let nextLoserLevel = loserLevel;
                if (loserDrop > 0) {
                    nextLoserLevel = Math.max(2, loserLevel - loserDrop);
                    description += ` [对方掉级:-${loserLevel - nextLoserLevel}]`;
                }

                return {
                    ...prev,
                    [winningTeam]: nextLevel,
                    [losingTeam]: nextLoserLevel
                };
            });
        }

        setGameResult({
            winnerTeam: winningTeam,
            increment: finalIncrement,
            newLevel: nextLevel,
            description,
            nextStarterName: winner.name
        });

        setActiveTeam(winningTeam);
        setIsFirstGame(false);
    }, [gameState, teamLevels]);

    // Game Over Logic-Calculate Levels
    useEffect(() => {
        if (gameState.phase === 'gameover' && gameState.rankings.length >= 2 && !gameResult) {
            calculateGameResult();
        }
    }, [gameState.phase, gameState.rankings, gameResult, calculateGameResult]);

    const handleTributeAction = (pending: TributePending, selectedCardId: string | null) => {
        setGameState(prev => {
            const players = [...prev.players];
            const fromIdx = players.findIndex(p => p.id === pending.fromId);
            const toIdx = players.findIndex(p => p.id === pending.toId);

            if (fromIdx === -1 || toIdx === -1) return prev;

            const fromP = { ...players[fromIdx] };
            const toP = { ...players[toIdx] };
            let cardToMove: Card | undefined;

            if (pending.type === 'MAX') {
                const sorted = [...fromP.hand].sort((a, b) => b.value - a.value);
                cardToMove = sorted[0];
            } else {
                if (selectedCardId) {
                    cardToMove = fromP.hand.find(c => c.id === selectedCardId);
                } else {
                    const sorted = [...fromP.hand].sort((a, b) => a.value - b.value);
                    cardToMove = sorted[0];
                }
            }

            if (!cardToMove) return prev;

            fromP.hand = fromP.hand.filter(c => c.id !== cardToMove.id);
            toP.hand = [...toP.hand, cardToMove];
            toP.hand = sortHand(toP.hand);

            players[fromIdx] = fromP;
            players[toIdx] = toP;

            const actionText = pending.type === 'MAX' ? '进贡' : '还牌';
            const msg = `${fromP.name} 向 ${toP.name} ${actionText}了 [${SUIT_SYMBOLS[cardToMove.suit]}${cardToMove.rank}]`;

            if (toP.id === 'p1') {
                setReceivedTribute({
                    card: cardToMove,
                    fromName: fromP.name
                });
            }

            const newQueue = tributeQueue.slice(1);
            setTributeQueue(newQueue);

            return {
                ...prev,
                players,
                message: msg,
                history: [...prev.history, { player: fromP.name, action: 'play', cards: [cardToMove], timestamp: Date.now() }]
            };
        });
        setSelectedCardIds(new Set());
    };

    // --- TRIBUTE LOGIC ---
    useEffect(() => {
        if (gameState.phase === 'tribute' && !receivedTribute) {
            if (tributeQueue.length > 0) {
                const next = tributeQueue[0];
                setCurrentTribute(next);

                const fromPlayer = gameState.players.find(p => p.id === next.fromId);
                if (fromPlayer && fromPlayer.isCpu && !fromPlayer.isManual) {
                    const timer = setTimeout(() => {
                        handleTributeAction(next, null);
                    }, 1500);
                    return () => clearTimeout(timer);
                }
            } else {
                setGameState(prev => ({ ...prev, phase: 'playing', message: "进贡结束，游戏开始！" }));
            }
        }
    }, [gameState.phase, tributeQueue, receivedTribute, gameState.players]);

    const dismissReceivedTribute = () => {
        setReceivedTribute(null);
    }

    const handleWatchAd = async () => {
        if (isLoadingAd) return;
        setIsLoadingAd(true);

        const success = await showRewardVideoAd();
        if (success) {
            setUserCoins(prev => prev + 2000);
            setIsLoadingAd(false);
            setGameState(prev => ({ ...prev, message: "广告观看完成，感谢您的支持！" }));
        } else {
            setIsLoadingAd(false);
            setGameState(prev => ({ ...prev, message: "广告加载失败或未完整观看" }));
        }
    };

    const startGame = () => {
        try {
            const levelToPlay = teamLevels[activeTeam];
            const deck = createDoubleDeck(levelToPlay);
            const handSize = 27;

            const p1Hand = sortHand(deck.slice(0, handSize));
            const p2Hand = sortHand(deck.slice(handSize, handSize * 2));
            const p3Hand = sortHand(deck.slice(handSize * 2, handSize * 3));
            const p4Hand = sortHand(deck.slice(handSize * 3, handSize * 4));

            let players: Player[] = [
                { id: 'p1', name: '我 (User)', hand: p1Hand, isCpu: false, position: 'bottom', role: activeTeam === 1 ? 'host' : 'guest', team: 1, lastAction: null, finishedRank: null },
                { id: 'p2', name: '下家 (CPU)', hand: p2Hand, isCpu: true, position: 'right', role: activeTeam === 2 ? 'host' : 'guest', team: 2, lastAction: null, finishedRank: null, isManual: false },
                { id: 'p3', name: '对家 (CPU)', hand: p3Hand, isCpu: true, position: 'top', role: activeTeam === 1 ? 'host' : 'guest', team: 1, lastAction: null, finishedRank: null, isManual: false },
                { id: 'p4', name: '上家 (CPU)', hand: p4Hand, isCpu: true, position: 'left', role: activeTeam === 2 ? 'host' : 'guest', team: 2, lastAction: null, finishedRank: null, isManual: false },
            ];

            let initialPhase: 'playing' | 'tribute' = 'playing';
            let initialMessage = `游戏开始！当前打级:${getRankStr(levelToPlay)}`;
            let startIndex = 0;
            let pendingTributes: TributePending[] = [];

            if (isFirstGame) {
                startIndex = findSpade3(players);
                initialMessage += `，由抓到黑桃3的 ${players[startIndex].name} 先出。`;
            } else {
                if (lastWinnerId) {
                    const foundIndex = players.findIndex(p => p.id === lastWinnerId);
                    if (foundIndex !== -1) startIndex = foundIndex;

                    if (lastRankings.length === 4) {
                        const p1Id = lastRankings[0];
                        const p2Id = lastRankings[1];
                        const p4Id = lastRankings[3];

                        const p1Obj = players.find(p => p.id === p1Id);
                        const p2Obj = players.find(p => p.id === p2Id);
                        const p4Obj = players.find(p => p.id === p4Id);

                        if (p1Obj && p2Obj && p4Obj) {
                            const isDoubleWin = p1Obj.team === p2Obj.team;
                            const isPingShang = p1Obj.team === p4Obj.team;

                            if (isDoubleWin) {
                                pendingTributes.push({ fromId: lastRankings[2], toId: p2Id, type: 'MAX' });
                                pendingTributes.push({ fromId: p4Id, toId: p1Id, type: 'MAX' });
                                pendingTributes.push({ fromId: p2Id, toId: lastRankings[2], type: 'RETURN' });
                                pendingTributes.push({ fromId: p1Id, toId: p4Id, type: 'RETURN' });
                                initialMessage = "双进！双贡双还阶段...";
                            } else if (isPingShang) {
                                initialMessage = "平上（双没）！无需进贡，游戏直接开始。";
                            } else {
                                pendingTributes.push({ fromId: p4Id, toId: p1Id, type: 'MAX' });
                                pendingTributes.push({ fromId: p1Id, toId: p4Id, type: 'RETURN' });
                                initialMessage = "单进！进贡还牌阶段...";
                            }

                            if (pendingTributes.length > 0) {
                                initialPhase = 'tribute';
                                setTributeQueue(pendingTributes);
                            }
                        }
                    }
                }
            }

            setGameState({
                currentLevel: levelToPlay,
                players,
                currentPlayerIndex: startIndex,
                lastPlayedCards: [],
                lastPlayedBy: null,
                phase: initialPhase,
                deck: [],
                message: initialMessage,
                history: [],
                isRoundPause: false,
                rankings: [],
                consecutivePasses: 0,
                tableState: {}
            });

            setShowHistory(false);
            setGameResult(null);
            setReceivedTribute(null);
        } catch (e: any) {
            console.error("Error starting game:", e);
        }
    };

    const toggleCardSelection = (cardId: string, linkState?: boolean) => {
        const newSelected = new Set(selectedCardIds);
        const isSelected = newSelected.has(cardId);
        const shouldSelect = linkState !== undefined ? linkState : !isSelected;

        if (shouldSelect) {
            newSelected.add(cardId);
        } else {
            newSelected.delete(cardId);
        }
        setSelectedCardIds(newSelected);
    };

    const handleCardTouchStart = (cardId: string, e: React.TouchEvent) => {
        if (gameState.phase === 'tribute' && currentTribute?.fromId === 'p1' && currentTribute.type === 'MAX') {
            return;
        }
        e.preventDefault(); // Prevent onClick from firing
        e.stopPropagation(); // Prevent bubbling to container
        const touch = e.touches[0];
        touchedCardId.current = cardId;
        touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    const handleCardTouchEnd = (cardId: string, e: React.TouchEvent) => {
        if (!touchStart.current || touchedCardId.current !== cardId) {
            touchedCardId.current = null;
            touchStart.current = null;
            return;
        }

        e.preventDefault(); // Prevent onClick from firing
        e.stopPropagation(); // Prevent bubbling

        const touch = e.changedTouches[0];
        const dist = Math.sqrt(
            Math.pow(touch.clientX - touchStart.current.x, 2) +
            Math.pow(touch.clientY - touchStart.current.y, 2)
        );
        const duration = Date.now() - touchStart.current.time;

        // More forgiving thresholds for mobile: 30px movement, 500ms duration
        if (dist < 30 && duration < 500) {
            toggleCardSelection(cardId);
            console.log('✓ Card selected:', cardId);
        } else {
            console.log('✗ Tap rejected - dist:', dist.toFixed(1), 'duration:', duration);
        }

        touchedCardId.current = null;
        touchStart.current = null;
    };

    const handleCardClick = (cardId: string) => {
        toggleCardSelection(cardId);
    };



    const toggleManualMode = (playerId: string) => {
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(p =>
                p.id === playerId ? { ...p, isManual: !p.isManual } : p
            )
        }));
    };

    const getNextActivePlayerIndex = (currentIndex: number, players: Player[]): number => {
        let nextIndex = (currentIndex + 1) % 4;
        let loopCount = 0;
        while (players[nextIndex].finishedRank && loopCount < 4) {
            nextIndex = (nextIndex + 1) % 4;
            loopCount++;
        }
        return nextIndex;
    };

    const handlePass = () => {
        if (gameState.phase !== 'playing') return;
        playActionSound('pass', [], isSoundOn, gameState.currentLevel);
        if (gameState.lastPlayedCards.length === 0) {
            setGameState(prev => ({ ...prev, message: "你是首家，必须出牌！" }));
            return;
        }

        setGameState(prev => {
            const currentPlayer = prev.players[prev.currentPlayerIndex];
            const newHistory = [...prev.history, {
                player: currentPlayer.name,
                action: 'pass' as const,
                timestamp: Date.now()
            }];
            const newConsecutivePasses = prev.consecutivePasses + 1;
            const activeCount = prev.players.filter(p => !p.finishedRank).length;
            const isRoundEnd = newConsecutivePasses >= (activeCount - 1);
            let nextPlayerIndex = getNextActivePlayerIndex(prev.currentPlayerIndex, prev.players);
            let nextMessage = "过牌...";
            let nextLastPlayedCards = prev.lastPlayedCards;
            let nextLastPlayedBy = prev.lastPlayedBy;
            let nextConsPasses = newConsecutivePasses;
            let isPause = false;

            const prevTableEntry = prev.tableState[currentPlayer.id] || {};
            const newTableState = {
                ...prev.tableState,
                [currentPlayer.id]: {
                    ...prevTableEntry,
                    action: 'pass' as const
                }
            };

            if (isRoundEnd) {
                nextMessage = "一轮结束，请出牌";
                nextLastPlayedCards = [];
                nextLastPlayedBy = null;
                nextConsPasses = 0;
                isPause = true;

                if (prev.lastPlayedBy) {
                    const winnerIdx = prev.players.findIndex(p => p.id === prev.lastPlayedBy);
                    if (winnerIdx !== -1) {
                        if (prev.players[winnerIdx].finishedRank) {
                            const partnerIdx = (winnerIdx + 2) % 4;
                            nextPlayerIndex = partnerIdx;
                            nextMessage = `上游已走，接风！轮到 ${prev.players[partnerIdx].name}`;
                        } else {
                            nextPlayerIndex = winnerIdx;
                        }
                    }
                }
            }

            const newPlayers = [...prev.players];
            newPlayers[prev.currentPlayerIndex] = { ...currentPlayer, lastAction: 'pass' };

            return {
                ...prev,
                players: newPlayers,
                currentPlayerIndex: nextPlayerIndex,
                message: nextMessage,
                history: newHistory,
                lastPlayedCards: nextLastPlayedCards,
                lastPlayedBy: nextLastPlayedBy,
                consecutivePasses: nextConsPasses,
                isRoundPause: isPause,
                tableState: newTableState
            };
        });
    };

    const handlePlay = () => {
        if (gameState.phase !== 'playing') return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const selectedCards = currentPlayer.hand.filter(c => selectedCardIds.has(c.id));

        if (selectedCards.length === 0) {
            setGameState(prev => ({ ...prev, message: "请选择要出的牌" }));
            return;
        }

        if (!isValidMove(selectedCards, gameState.lastPlayedCards)) {
            setGameState(prev => ({ ...prev, message: "牌型不符合规则或太小" }));
            return;
        }

        try {
            playActionSound('play', selectedCards, isSoundOn, gameState.currentLevel);
        } catch (error) {
            console.error("Audio playback failed", error);
        }

        setGameState(prev => {
            const newHand = currentPlayer.hand.filter(c => !selectedCardIds.has(c.id));
            const newPlayers = [...prev.players];
            let finishedRank: number | null = currentPlayer.finishedRank;
            const newRankings = [...prev.rankings];

            if (newHand.length === 0) {
                finishedRank = prev.rankings.length + 1;
                newRankings.push(currentPlayer.id);
            }

            newPlayers[prev.currentPlayerIndex] = { ...currentPlayer, hand: newHand, lastAction: 'play', finishedRank };
            const newHistory = [...prev.history, {
                player: currentPlayer.name,
                action: 'play' as const,
                cards: selectedCards,
                timestamp: Date.now()
            }];

            let nextPlayerIndex = getNextActivePlayerIndex(prev.currentPlayerIndex, newPlayers);
            let nextMessage = "出牌成功";

            if (newRankings.length === 2) {
                const winner1 = newPlayers.find(p => p.id === newRankings[0]);
                const winner2 = newPlayers.find(p => p.id === newRankings[1]);
                if (winner1 && winner2 && winner1.team === winner2.team) {
                    const losers = newPlayers.filter(p => !p.finishedRank).sort((a, b) => a.hand.length - b.hand.length);
                    losers.forEach((p, i) => {
                        newRankings.push(p.id);
                        const idx = newPlayers.findIndex(pl => pl.id === p.id);
                        newPlayers[idx].finishedRank = 3 + i;
                    });
                    return { ...prev, players: newPlayers, rankings: newRankings, phase: 'gameover', message: "双上！游戏结束！" };
                }
            }

            if (newRankings.length === 3) {
                const lastOne = newPlayers.find(p => !p.finishedRank && p.id !== currentPlayer.id);
                if (lastOne) {
                    newRankings.push(lastOne.id);
                    const lastIdx = newPlayers.findIndex(p => p.id === lastOne.id);
                    newPlayers[lastIdx].finishedRank = 4;
                }
                return { ...prev, players: newPlayers, rankings: newRankings, phase: 'gameover', message: "游戏结束！" };
            }

            let newTableState = { ...prev.tableState };
            if (prev.lastPlayedCards.length === 0) newTableState = {};
            newTableState[currentPlayer.id] = { action: 'play', cards: selectedCards };

            return {
                ...prev,
                players: newPlayers,
                lastPlayedCards: selectedCards,
                lastPlayedBy: currentPlayer.id,
                consecutivePasses: 0,
                currentPlayerIndex: nextPlayerIndex,
                message: nextMessage,
                history: newHistory,
                rankings: newRankings,
                isRoundPause: true,
                tableState: newTableState
            };
        });
        setSelectedCardIds(new Set());
    };

    useEffect(() => {
        if (gameState.phase !== 'playing') return;
        if (gameState.isRoundPause) {
            const timer = setTimeout(() => {
                setGameState(prev => ({
                    ...prev,
                    players: prev.players.map(p => ({ ...p, lastAction: null })),
                    isRoundPause: false,
                }));
            }, 1200);
            return () => clearTimeout(timer);
        }

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer.isCpu && !currentPlayer.isManual && !currentPlayer.finishedRank) {
            const timer = setTimeout(() => {
                const cardsToPlay = findBestMove(
                    currentPlayer.hand,
                    gameState.lastPlayedCards,
                    gameState.lastPlayedBy,
                    gameState.players,
                    gameState.currentPlayerIndex
                );

                if (cardsToPlay) {
                    playActionSound('play', cardsToPlay, isSoundOn, gameState.currentLevel);
                    const ids = new Set(cardsToPlay.map(c => c.id));
                    setGameState(prev => {
                        const cpuP = prev.players[prev.currentPlayerIndex];
                        const newHand = cpuP.hand.filter(c => !ids.has(c.id));
                        const newPlayers = [...prev.players];
                        let finishedRank: number | null = cpuP.finishedRank;
                        const newRankings = [...prev.rankings];

                        if (newHand.length === 0) {
                            finishedRank = prev.rankings.length + 1;
                            newRankings.push(cpuP.id);
                        }

                        newPlayers[prev.currentPlayerIndex] = { ...cpuP, hand: newHand, lastAction: 'play', finishedRank };
                        const newHistory = [...prev.history, {
                            player: cpuP.name,
                            action: 'play' as const,
                            cards: cardsToPlay,
                            timestamp: Date.now()
                        }];

                        if (newRankings.length === 2) {
                            const winner1 = newPlayers.find(p => p.id === newRankings[0]);
                            const winner2 = newPlayers.find(p => p.id === newRankings[1]);
                            if (winner1 && winner2 && winner1.team === winner2.team) {
                                const losers = newPlayers.filter(p => !p.finishedRank).sort((a, b) => a.hand.length - b.hand.length);
                                losers.forEach((p, i) => {
                                    newRankings.push(p.id);
                                    const idx = newPlayers.findIndex(pl => pl.id === p.id);
                                    newPlayers[idx].finishedRank = 3 + i;
                                });
                                return { ...prev, players: newPlayers, rankings: newRankings, phase: 'gameover', message: "双上！游戏结束！" };
                            }
                        }

                        if (newRankings.length === 3) {
                            const lastOne = newPlayers.find(p => !p.finishedRank && p.id !== cpuP.id);
                            if (lastOne) {
                                newRankings.push(lastOne.id);
                                const lastIdx = newPlayers.findIndex(p => p.id === lastOne.id);
                                newPlayers[lastIdx].finishedRank = 4;
                            }
                            return { ...prev, players: newPlayers, rankings: newRankings, phase: 'gameover', message: "游戏结束！" };
                        }

                        let newTableState = { ...prev.tableState };
                        if (prev.lastPlayedCards.length === 0) newTableState = {};
                        newTableState[cpuP.id] = { action: 'play', cards: cardsToPlay };

                        return {
                            ...prev,
                            players: newPlayers,
                            lastPlayedCards: cardsToPlay,
                            lastPlayedBy: cpuP.id,
                            consecutivePasses: 0,
                            currentPlayerIndex: getNextActivePlayerIndex(prev.currentPlayerIndex, newPlayers),
                            message: `CPU ${cpuP.name} 出牌`,
                            history: newHistory,
                            rankings: newRankings,
                            isRoundPause: true,
                            tableState: newTableState
                        };
                    });
                } else {
                    handlePass();
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [gameState.currentPlayerIndex, gameState.phase, gameState.isRoundPause, gameState.players, gameState.lastPlayedCards, isSoundOn]);

    const scrollHand = (direction: 'left' | 'right') => {
        if (handScrollRef.current) {
            const scrollAmount = 300;
            handScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const renderOpponentHand = (player: Player) => null;

    const renderPlayer = (position: 'top' | 'left' | 'right') => {
        const player = gameState.players.find(p => p.position === position);
        if (!player) return null;
        const isActive = player.id === gameState.players[gameState.currentPlayerIndex]?.id;

        const miniLayout = position === 'top' ? 'col' : 'row';

        return (
            <div className={`${position === 'top' ? 'absolute top-2 landscape:top-1 left-1/2 -translate-x-1/2 flex-col' : position === 'left' ? 'fixed top-1/2 left-2 landscape:left-1 -translate-y-1/2 flex-row' : 'fixed top-1/2 right-2 landscape:right-1 -translate-y-1/2 flex-row-reverse'} flex items-center gap-4 z-40`}>
                <PlayerAvatar player={player} isActive={isActive} cardCount={player.hand.length} />

                <button
                    onClick={() => toggleManualMode(player.id)}
                    className={`p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/50 hover:text-white transition-colors ${player.isManual ? 'text-green-400 bg-black/60' : ''}`}
                    title="托管/手动"
                >
                    <MousePointer2 size={12} />
                </button>

                <div
                    ref={(el) => { if (el) miniHandRefs.current[player.id] = el; }}
                    className={`relative flex ${position === 'top' ? 'h-24 w-64 justify-center' : 'w-24 h-64 flex-col items-center'} ${player.finishedRank ? 'opacity-0' : ''}`}
                >
                    {(isOpenHand || player.isManual) ? (
                        player.hand.map((card, idx) => (
                            <div
                                key={card.id}
                                className="absolute transform origin-center transition-transform hover:z-50 hover:scale-125"
                                style={{
                                    zIndex: idx,
                                    left: position === 'top' ? `${(idx - player.hand.length / 2) * 15 + 128}px` : undefined,
                                    top: position !== 'top' ? `${(idx - player.hand.length / 2) * 15 + 128}px` : undefined
                                }}
                                onClick={() => player.isManual && gameState.currentPlayerIndex === gameState.players.findIndex(p => p.id === player.id) && handleCardClick(card.id)}
                            >
                                <CardComponent
                                    card={card}
                                    mini={true}
                                    miniLayout={miniLayout}
                                    isSelected={selectedCardIds.has(card.id) && player.id === gameState.players[gameState.currentPlayerIndex].id}
                                />
                            </div>
                        ))
                    ) : (
                        renderOpponentHand(player)
                    )}
                </div>
            </div>
        );
    };

    const renderTableCards = (player: Player) => {
        const tableEntry = gameState.tableState[player.id];
        if (!tableEntry) return null;

        let posClass = "";
        let rotClass = "";
        // Modified: Tighter spacing on desktop (md) to show approx half card width (-space-x-8 is 2rem/32px, card is w-14/w-16)
        let cardSpacing = "-space-x-2 sm:-space-x-4 md:-space-x-8";

        const isLastPlayed = gameState.lastPlayedBy === player.id;
        const zIndex = isLastPlayed ? 50 : 10;

        switch (player.position) {
            case 'bottom':
                posClass = isSmartSort
                    ? "fixed top-[55%] left-1/2 -translate-x-1/2"
                    : "absolute bottom-[15%] left-1/2 -translate-x-1/2 landscape:bottom-[2%] landscape:left-1/2 md:bottom-[15%] md:left-1/2";
                break;
            case 'top':
                posClass = isSmartSort
                    ? "absolute top-[40%] landscape:top-[30%] left-1/2 -translate-x-1/2"
                    : "absolute top-[25%] landscape:top-[15%] md:top-[25%] left-1/2 -translate-x-1/2";
                break;
            case 'left':
                posClass = isSmartSort
                    ? "fixed top-[45%] left-[25%] landscape:left-[20%] -translate-y-1/2"
                    : "fixed top-1/2 left-[25%] landscape:left-[20%] -translate-y-1/2";
                rotClass = "rotate-90";
                break;
            case 'right':
                posClass = isSmartSort
                    ? "fixed top-[45%] right-[25%] landscape:right-[20%] -translate-y-1/2"
                    : "fixed top-1/2 right-[25%] landscape:right-[20%] -translate-y-1/2";
                rotClass = "-rotate-90";
                break;
        }

        return (
            <div className={`${posClass.includes('fixed') ? '' : 'absolute'} ${posClass} flex flex-col items-center pointer-events-none transition-all duration-300`} style={{ zIndex }}>
                {tableEntry.action === 'pass' && (
                    <div className="bg-stone-800/80 text-stone-400 px-3 py-1 text-sm rounded-lg backdrop-blur font-bold border border-white/10 shadow-lg animate-fade-in mb-2">
                        过牌
                    </div>
                )}
                {tableEntry.cards && (
                    <div className={`flex ${cardSpacing} scale-75 landscape:scale-[0.65] md:scale-125 origin-center animate-in zoom-in duration-300 ${tableEntry.action === 'pass' ? 'opacity-50 grayscale' : ''} ${rotClass} ${isLastPlayed ? 'drop-shadow-2xl brightness-110' : 'brightness-90'}`}>
                        {tableEntry.cards.map((card) => (
                            <div key={card.id} className="transform hover:-translate-y-2 transition-transform shadow-xl">
                                <CardComponent card={card} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    const isMyTurn = (activePlayer?.id === 'p1') || (activePlayer?.isManual && activePlayer?.isCpu);
    const showControls = gameState.phase === 'playing' && isMyTurn && !gameState.isRoundPause;

    return (
        <div className="fixed inset-0 bg-emerald-900 overflow-hidden flex flex-col font-sans">


            {gameState.phase === 'lobby' && (
                <div className="absolute inset-0 z-50 bg-stone-950 text-white overflow-y-auto">
                    <div className="min-h-full flex flex-col items-center justify-center p-8">
                        <div className="mb-8 animate-float">
                            <GameLogo size={180} variant="full" />
                        </div>
                        <div className="flex gap-8 mb-12">
                            <div className="text-center p-6 bg-stone-800 rounded-xl border border-stone-700">
                                <div className="text-stone-400 mb-2 uppercase tracking-wider text-xs">当前等级 (我方)</div>
                                <div className="text-5xl font-mono font-bold text-blue-400">{getRankStr(teamLevels[1])}</div>
                            </div>
                            <div className="text-center p-6 bg-stone-800 rounded-xl border border-stone-700">
                                <div className="text-stone-400 mb-2 uppercase tracking-wider text-xs">当前等级 (敌方)</div>
                                <div className="text-5xl font-mono font-bold text-red-400">{getRankStr(teamLevels[2])}</div>
                            </div>
                        </div>
                        <button onClick={() => startGame()} className="px-12 py-4 bg-yellow-500 hover:bg-yellow-400 text-stone-900 font-bold rounded-full text-xl shadow-lg shadow-yellow-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <Play size={24} fill="currentColor" /> 开始游戏
                        </button>
                    </div>
                </div>
            )}

            {gameState.players.length > 0 && gameState.phase !== 'lobby' && (
                <>
                    <div className="flex-1 relative w-full max-w-7xl mx-auto">
                        <div className="absolute top-0 left-0 right-0 p-2 landscape:p-1 flex justify-between items-start z-[100]">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setGameState({ ...gameState, phase: 'lobby' })} className="p-2 bg-stone-800/80 rounded-full text-stone-400 hover:text-white backdrop-blur">
                                    <RotateCcw size={16} />
                                </button>
                                <button onClick={() => setShowHistory(true)} className="p-2 bg-stone-800/80 rounded-full text-stone-400 hover:text-white backdrop-blur">
                                    <ScrollText size={16} />
                                </button>
                                <button onClick={() => setIsOpenHand(!isOpenHand)} className="p-2 bg-stone-800/80 rounded-full text-stone-400 hover:text-white backdrop-blur">
                                    {isOpenHand ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <button onClick={() => setIsSmartSort(!isSmartSort)} className={`p-2 rounded-full backdrop-blur transition-colors ${isSmartSort ? 'bg-yellow-600 text-white' : 'bg-stone-800/80 text-stone-400 hover:text-white'}`}>
                                    <Sparkles size={16} />
                                </button>
                                <button onClick={() => setIsSoundOn(!isSoundOn)} className="p-2 bg-stone-800/80 rounded-full text-stone-400 hover:text-white backdrop-blur">
                                    {isSoundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                </button>
                                <button onClick={() => setShowShop(true)} className="p-2 bg-yellow-500/20 hover:bg-yellow-500/40 rounded-full text-yellow-500 hover:text-yellow-400 backdrop-blur border border-yellow-500/30">
                                    <ShoppingCart size={16} />
                                </button>
                            </div>
                            <div className="flex flex-col items-end gap-1 pointer-events-none">
                                <div className="bg-stone-900/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                    <GameLogo size={16} variant="icon" />
                                    <div className="w-px h-3 bg-white/20"></div>
                                    <span className="text-xs font-mono text-blue-400">级:{getRankStr(gameState.currentLevel)}</span>
                                    <span className="w-px h-3 bg-white/20"></span>
                                    <span className="text-xs font-mono text-stone-300">我:{getRankStr(teamLevels[1])}</span>
                                    <span className="text-xs font-mono text-stone-300">敌:{getRankStr(teamLevels[2])}</span>
                                </div>
                                {gameState.message && <div className="bg-black/50 text-white px-3 py-1 rounded text-sm animate-fade-in">{gameState.message}</div>}
                            </div>
                        </div>

                        {renderPlayer('top')}
                        {renderPlayer('left')}
                        {renderPlayer('right')}

                        <div className="absolute inset-0 pointer-events-none">
                            {gameState.players.map(p => <React.Fragment key={p.id}>{renderTableCards(p)}</React.Fragment>)}
                            {gameState.consecutivePasses > 0 && gameState.lastPlayedCards.length > 0 && (
                                <div className="absolute bottom-[40%] left-1/2 -translate-x-1/2 text-stone-400 text-sm bg-stone-900/80 px-2 py-0.5 rounded backdrop-blur">{gameState.consecutivePasses} 家过牌</div>
                            )}
                        </div>

                        {receivedTribute && (
                            <div className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                                <div className="bg-stone-800 p-8 rounded-2xl border border-yellow-500/30 flex flex-col items-center gap-6 shadow-2xl animate-bounce-in">
                                    <div className="text-2xl font-bold text-yellow-400 flex items-center gap-2"><Gift /> 收到进贡</div>
                                    <div className="text-stone-300"><span className="font-bold text-white">{receivedTribute.fromName}</span> 进贡了一张牌：</div>
                                    <div className="scale-125"><CardComponent card={receivedTribute.card} /></div>
                                    <button onClick={dismissReceivedTribute} className="mt-4 px-8 py-2 bg-yellow-500 hover:bg-yellow-400 text-stone-900 font-bold rounded-full">收下</button>
                                </div>
                            </div>
                        )}

                        {gameState.phase === 'gameover' && gameResult && (
                            <div className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md">
                                <div className="bg-gradient-to-br from-stone-800 to-stone-900 p-1 bg-stone-800 rounded-2xl shadow-2xl max-w-md w-full m-4">
                                    <div className="bg-stone-900 rounded-xl p-8 flex flex-col items-center text-center relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                                        <div className="mb-6 relative">
                                            {gameResult.winnerTeam === 1 ? (
                                                <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500 animate-pulse"><Trophy size={40} /></div>
                                            ) : (
                                                <div className="w-20 h-20 bg-stone-700 rounded-full flex items-center justify-center text-stone-400"><X size={40} /></div>
                                            )}
                                            {gameResult.increment > 0 && <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-stone-800">+{gameResult.increment}级</div>}
                                        </div>
                                        <h2 className="text-3xl font-bold text-white mb-2">{gameResult.winnerTeam === 1 ? '胜利!' : '失败'}</h2>
                                        <p className="text-stone-400 mb-6 text-sm">{gameResult.description}</p>
                                        <div className="w-full bg-stone-800/50 rounded-lg p-4 mb-8 flex items-center justify-between border border-stone-700/50">
                                            <div className="flex flex-col items-start"><span className="text-xs text-stone-500 uppercase">下一级</span><span className="text-xl font-mono font-bold text-blue-400">{getRankStr(teamLevels[1])}</span></div>
                                            <TrendingUp className="text-stone-600" />
                                            <div className="flex flex-col items-end"><span className="text-xs text-stone-500 uppercase">敌方</span><span className="text-xl font-mono font-bold text-red-400">{getRankStr(teamLevels[2])}</span></div>
                                        </div>
                                        <button onClick={() => startGame()} className="w-full py-3 bg-white text-stone-900 font-bold rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center gap-2">下一局 <ChevronRight size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Tribute Controls */}
                    {!showControls && gameState.phase === 'tribute' && currentTribute && currentTribute.fromId === 'p1' && (
                        <div className="fixed z-[5000] bottom-[35%] left-1/2 -translate-x-1/2 landscape:bottom-[25%] px-6 py-3 bg-black/80 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl pointer-events-auto">
                            <button
                                onClick={() => handleTributeAction(currentTribute!, Array.from(selectedCardIds)[0] || null)}
                                disabled={currentTribute.type !== 'MAX' && selectedCardIds.size !== 1}
                                className="px-10 py-3 bg-yellow-600 hover:bg-yellow-500 text-white text-base font-black rounded-xl shadow-lg border-2 border-yellow-400 transition-all active:scale-90"
                            >
                                {currentTribute.type === 'MAX' ? '进贡 (自动最大)' : '还牌 (选一张)'}
                            </button>
                        </div>
                    )}

                    <div className="relative z-[90] pointer-events-none pt-2 pb-2">

                        <div className={`relative group w-full flex items-center justify-center -mb-2 ${isSmartSort ? 'translate-y-8' : ''}`}>
                            <button onClick={() => scrollHand('left')} className="pointer-events-auto absolute left-1 z-30 p-2 bg-stone-800/80 rounded-full text-white shadow-lg backdrop-blur hover:bg-stone-700 active:scale-95 hidden group-hover:block lg:block"><ChevronLeft size={24} /></button>
                            <div
                                ref={handScrollRef}
                                className={`pointer-events-auto w-full px-4 pb-4 scrollbar-hide select-none relative overflow-x-auto ${isSmartSort ? 'pt-32 landscape:pt-12' : 'pt-12'}`}
                                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
                            >
                                <div className="inline-flex min-w-[120vw] justify-center px-10 pr-32 items-end">
                                    {isSmartSort ? (
                                        <div className="flex gap-2 items-end justify-center">
                                            {groupHandForDisplay(gameState.players[0].hand).map((group, gIdx) => (
                                                <div
                                                    key={gIdx}
                                                    className="flex flex-col items-center -space-y-8 sm:-space-y-10 md:-space-y-12 hover:-translate-y-2 transition-transform pb-2"
                                                >
                                                    {group.map((card, cIdx) => (
                                                        <div
                                                            key={card.id}
                                                            data-card-id={card.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!(gameState.phase === 'tribute' && currentTribute?.fromId === 'p1' && currentTribute.type === 'MAX')) {
                                                                    toggleCardSelection(card.id);
                                                                }
                                                            }}
                                                            className={`transform transition-all cursor-pointer ${selectedCardIds.has(card.id) ? 'brightness-75' : ''}`}
                                                            style={{ zIndex: 10 + cIdx, position: 'relative', touchAction: 'pan-x' }}
                                                        >
                                                            <CardComponent card={card} compact={cIdx !== group.length - 1} isSelected={selectedCardIds.has(card.id)} disableSelectionMove={true} />
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex -space-x-4 sm:-space-x-5 md:-space-x-6">
                                            {gameState.players[0].hand.map((card, idx) => (
                                                <div
                                                    key={card.id}
                                                    data-card-id={card.id}
                                                    onClick={() => {
                                                        if (!(gameState.phase === 'tribute' && currentTribute?.fromId === 'p1' && currentTribute.type === 'MAX')) {
                                                            toggleCardSelection(card.id);
                                                        }
                                                    }}
                                                    onTouchStart={(e) => handleCardTouchStart(card.id, e)}
                                                    onTouchEnd={(e) => handleCardTouchEnd(card.id, e)}
                                                    className={`transform transition-all active:scale-110 cursor-pointer ${selectedCardIds.has(card.id) ? '-translate-y-4' : ''}`}
                                                    style={{ zIndex: idx, touchAction: 'manipulation' }}
                                                >
                                                    <CardComponent card={card} isSelected={selectedCardIds.has(card.id)} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => scrollHand('right')} className="absolute right-1 z-30 p-2 bg-stone-800/80 rounded-full text-white shadow-lg backdrop-blur hover:bg-stone-700 active:scale-95 hidden group-hover:block lg:block"><ChevronRight size={24} /></button>
                        </div>

                        <div className="absolute landscape:bottom-2 landscape:left-4 portrait:bottom-40 portrait:left-2 flex items-center gap-3 z-30 pointer-events-none scale-75 md:scale-100 origin-bottom-left">
                            <PlayerAvatar player={gameState.players[0]} isActive={gameState.currentPlayerIndex === 0} cardCount={gameState.players[0].hand.length} />
                        </div>
                    </div>

                    {showControls && (
                        <div className={`fixed z-[5000] flex gap-3 items-center pointer-events-none
                            ${isSmartSort
                                ? 'bottom-[22%] right-10'
                                : 'bottom-[25%] right-10'
                            }`}>
                            <button
                                onClick={handlePass}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl shadow-xl border border-red-400 transition-all active:scale-95 pointer-events-auto"
                            >
                                过牌
                            </button>
                            <button
                                onClick={handlePlay}
                                className={`px-8 py-2.5 text-sm font-bold rounded-xl shadow-xl border transition-all flex items-center gap-1 active:scale-95 ${selectedCardIds.size > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-900/40' : 'bg-stone-800 text-stone-500 border-stone-700 opacity-50'}`}
                            >
                                出牌 {selectedCardIds.size > 0 && <span className="bg-black/30 px-1.5 py-0.5 rounded text-xs">{selectedCardIds.size}</span>}
                            </button>
                        </div>
                    )}

                    {showShop && (
                        <div className="absolute inset-0 z-[50000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="bg-stone-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-yellow-500/20 flex flex-col overflow-hidden max-h-[90vh]">
                                <div className="p-4 border-b border-stone-700 flex justify-between items-center bg-stone-900/50">
                                    <div className="flex items-center gap-2 text-yellow-500"><ShoppingCart /><span className="font-bold text-lg">游戏商店</span></div>
                                    <button onClick={() => setShowShop(false)} className="p-2 hover:bg-stone-700 rounded-full text-stone-400"><X size={20} /></button>
                                </div>
                                <div className="p-6 overflow-y-auto grid grid-cols-1 gap-4">

                                    <div className="bg-stone-700/50 p-4 rounded-xl border border-stone-600 flex flex-col gap-3">
                                        <div className="flex justify-between items-start"><div className="p-3 bg-green-500/10 rounded-lg text-green-400"><Zap size={24} /></div></div>
                                        <div><h4 className="font-bold text-white">支持作者</h4><p className="text-xs text-stone-400 mt-1">如果您觉得游戏好玩，可以看段广告支持我们，感谢您的鼓励！</p></div>
                                        <button onClick={() => { handleWatchAd(); setShowShop(false); }} disabled={isLoadingAd} className="mt-2 w-full py-2 border border-green-500 text-green-400 hover:bg-green-500 hover:text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50">{isLoadingAd ? '加载中...' : '观看广告支持'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {showHistory && (
                        <div className="fixed inset-y-0 right-0 w-80 bg-stone-900 shadow-2xl border-l border-stone-700 z-[6000] flex flex-col animate-in slide-in-from-right pt-4 landscape:pt-8">
                            <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-950">
                                <h3 className="font-bold text-stone-200 flex items-center gap-2"><Clock size={16} /> 出牌记录</h3>
                                <button onClick={() => setShowHistory(false)} className="p-2 mr-8 hover:bg-stone-800 rounded text-stone-400"><X size={20} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {gameState.history.map((record, i) => (
                                    <div key={i} className="flex flex-col gap-1 text-sm border-b border-white/5 pb-2 last:border-0">
                                        <div className="flex justify-between text-stone-400 text-xs">
                                            <span>{record.player}</span>
                                            <span>{new Date(Number(record.timestamp || 0)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                        </div>
                                        <div className="font-medium text-stone-200">
                                            {record.action === 'pass' ? (
                                                <span className="text-stone-500 italic">过牌</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {record.cards?.map(c => (
                                                        <span key={c.id} className={`${SUIT_SYMBOLS[c.suit] ? '' : 'text-xs'}${(c.suit === 'D' || c.suit === 'H' || c.rank === 'RJ') ? 'text-red-400' : 'text-slate-300'}`}>
                                                            {SUIT_SYMBOLS[c.suit]}{c.rank === 'BJ' ? '小王' : c.rank === 'RJ' ? '大王' : c.rank}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={historyEndRef} />
                            </div>
                        </div>
                    )}
                    {showControls && (
                        <div className={`fixed z-[100] flex gap-3 items-center
                            ${isSmartSort
                                ? 'bottom-[22%] right-10'
                                : 'bottom-[25%] right-10'
                            }`}>
                            <button
                                onClick={handlePass}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl shadow-xl border border-red-400 transition-all active:scale-95"
                            >
                                过牌
                            </button>
                            <button
                                onClick={handlePlay}
                                className={`px-8 py-2.5 text-sm font-bold rounded-xl shadow-xl border transition-all flex items-center gap-1 active:scale-95 ${selectedCardIds.size > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-900/40' : 'bg-stone-800 text-stone-500 border-stone-700 opacity-50'}`}
                            >
                                出牌 {selectedCardIds.size > 0 && <span className="bg-black/30 px-1.5 py-0.5 rounded text-xs">{selectedCardIds.size}</span>}
                            </button>
                        </div>
                    )}

                    {/* Tribute Controls */}
                    {!showControls && gameState.phase === 'tribute' && currentTribute && currentTribute.fromId === 'p1' && (
                        <div className="fixed bottom-[30%] left-1/2 -translate-x-1/2 z-[10000] flex gap-4">
                            <div className="bg-black/60 text-white px-6 py-3 rounded-xl backdrop-blur-md border border-yellow-500/30 shadow-2xl animate-bounce">
                                <div className="font-bold text-lg text-yellow-400 mb-1 text-center">
                                    {currentTribute.type === 'MAX' ? '进贡时刻' : '还牌时刻'}
                                </div>
                                <div className="text-sm text-stone-300">
                                    {currentTribute.type === 'MAX'
                                        ? '请选择一张最大的牌进贡'
                                        : '请选择一张牌还给对方'}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (selectedCardIds.size === 1) {
                                        const cardId = Array.from(selectedCardIds)[0];
                                        handleTributeAction(currentTribute, cardId);
                                    } else if (currentTribute.type === 'MAX' && selectedCardIds.size === 0) {
                                        // Auto find max
                                        handleTributeAction(currentTribute, null);
                                    }
                                }}
                                disabled={currentTribute.type === 'RETURN' && selectedCardIds.size !== 1}
                                className={`px-6 py-3 font-bold rounded-xl shadow-lg transition-all ${(selectedCardIds.size === 1 || currentTribute.type === 'MAX')
                                    ? 'bg-gradient-to-r from-yellow-600 to-amber-600 text-white hover:scale-105'
                                    : 'bg-stone-700 text-stone-500 cursor-not-allowed'
                                    }`}
                            >
                                确认{currentTribute.type === 'MAX' ? '进贡' : '还牌'}
                            </button>
                        </div>
                    )}


                </>
            )}
        </div>
    );
};

export default App;
