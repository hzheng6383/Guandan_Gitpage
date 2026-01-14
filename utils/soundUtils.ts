import { Card } from '../types';
import { HandPattern, analyzePattern } from './gameLogic';

import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// Keep synth for Web Fallback
const synth = window.speechSynthesis;

// Helper to convert logical value back to spoken text
const getValueText = (value: number, currentLevel: number): string => {
    // Logic for Level Card (usually value 15 or 16 in gameLogic)
    if (value === 15 || value === 16) {
        return getRankTextFromNumber(currentLevel);
    }

    // Logic for Jokers
    if (value === 20) return '小王';
    if (value === 21) return '大王';

    // Logic for Ace
    if (value === 14) return '尖';

    return getRankTextFromNumber(value);
};

const getRankTextFromNumber = (rankVal: number): string => {
    switch (rankVal) {
        case 2: return '二';
        case 3: return '三';
        case 4: return '四';
        case 5: return '五';
        case 6: return '六';
        case 7: return '七';
        case 8: return '八';
        case 9: return '九';
        case 10: return '十';
        case 11: return '勾';
        case 12: return '皮';
        case 13: return '凯';
        case 14: return '尖';
        default: return rankVal.toString();
    }
}

// Removed playSnapSound to ensure clear voice output without interference

const speak = async (text: string) => {
    // Platform Check: Native (Android/iOS)
    if (Capacitor.isNativePlatform()) {
        try {
            // Stop previous speak if any (clean start)
            await TextToSpeech.stop();
            await TextToSpeech.speak({
                text: text,
                lang: 'zh-CN',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                category: 'ambient',
            });
        } catch (e) {
            console.warn("Native TTS error:", e);
        }
    } else {
        // Fallback: Web (Browser)
        // Run in next tick to avoid blocking main thread (CRITICAL for Android WebView if used there)
        setTimeout(() => {
            try {
                // Cancel any ongoing speech to prevent overlapping/queueing
                if (synth.speaking) {
                    synth.cancel();
                }

                const utterThis = new SpeechSynthesisUtterance(text);
                utterThis.lang = 'zh-CN';
                utterThis.rate = 1.0; // Slower rate for clarity (default is 1.0)
                utterThis.pitch = 1.0;

                // Attempt to find a high-quality Chinese voice
                const voices = synth.getVoices();
                // Prioritize Google or Microsoft voices as they tend to be clearer
                const bestVoice = voices.find(v =>
                    v.lang.includes('zh') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Yu-shu'))
                ) || voices.find(v => v.lang.includes('zh'));

                if (bestVoice) {
                    utterThis.voice = bestVoice;
                }

                synth.speak(utterThis);
            } catch (e) {
                console.warn("Speech synthesis encountered an error, suppressing to protect game loop:", e);
            }
        }, 0);
    }
};

const getPatternText = (pattern: HandPattern, cards: Card[], currentLevel: number): string => {
    if (cards.length === 0) return '';

    // Use pattern.value for consistent rank naming (handles Wild cards correctly)
    const valText = getValueText(pattern.value, currentLevel);

    switch (pattern.type) {
        case 'single':
            return valText;
        case 'pair':
            return `对${valText}`;
        case 'triple':
            return `三个${valText}`;
        case 'fullhouse':
            // "Three 5s with a pair" -> "三个五带一对" (or just "三个五带二")
            return `三个${valText}带一对`;
        case 'straight':
            return '顺子';
        case 'tube':
            return '三连对';
        case 'plate':
            return '钢板';
        case 'bomb':
            if (pattern.count >= 6) return `${pattern.count}头炸`;
            return '炸弹';
        case 'kingbomb':
            return '天王炸';
        default:
            return '';
    }
};

export const playActionSound = (action: 'play' | 'pass', cards: Card[] = [], isSoundOn: boolean, currentLevel: number) => {
    if (!isSoundOn) return;

    if (action === 'play') {
        const pattern = analyzePattern(cards);
        const text = getPatternText(pattern, cards, currentLevel);
        if (text) {
            // FIRE AND FORGET - Do not await
            speak(text);
        }
    } else {
        speak('不要');
    }
};