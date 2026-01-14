import { AdMob, RewardAdOptions, RewardAdPluginEvents, AdMobRewardItem } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Declare H5 Games Ads types for Web
declare global {
  interface Window {
    adConfig: (options: any) => void;
    adBreak: (options: any) => void;
  }
}

const ADMOB_AD_UNIT_ID = 'ca-app-pub-2021620802863936/2874220475';

export const initializeAdMob = async () => {
  // 1. Web Environment (AdSense H5 Games)
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Running on Web. Configuring H5 Games Ads...');
    if (window.adConfig) {
      window.adConfig({
        sound: 'on',
        preloadAdBreaks: 'on'
      });
    } else {
      console.warn('AdSense script not loaded in index.html');
    }
    return;
  }

  // 2. Native Environment (AdMob)
  try {
    await AdMob.initialize({
      // requestTrackingAuthorization: true, // REMOVED: Cause of error and valid for iOS mainly
      // testingDevices: ['2077ef9a63d2b398840261c8221a0c9b'], // COMMENT OUT for Production
      // initializeForTesting: true, // COMMENT OUT for Production
    });
    console.log('AdMob initialized');
  } catch (e) {
    console.error('AdMob init failed', e);
  }
};

export const showRewardVideoAd = async (): Promise<boolean> => {
  // 1. Web Environment (AdSense H5 Games)
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Web environment, requesting H5 Reward Ad...');
    return new Promise((resolve) => {
      if (typeof window.adBreak !== 'function') {
        console.warn('window.adBreak is not a function. Simulating success for dev.');
        setTimeout(() => resolve(true), 1000);
        return;
      }

      window.adBreak({
        type: 'reward',
        name: 'support_author',
        beforeAd: () => { console.log('Web Ad: Pausing Game'); },
        afterAd: () => { console.log('Web Ad: Resuming Game'); },
        adBreakDone: (placementInfo: any) => {
          console.log('Web Ad Result:', placementInfo);
          if (placementInfo.breakStatus === 'viewed') {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    });
  }

  // 2. Native Environment (AdMob)
  try {
    const options: RewardAdOptions = {
      adId: ADMOB_AD_UNIT_ID,
      // isTesting: true // COMMENT OUT for Production
    };

    // Prepare variables for Promise resolution
    let resolvePromise: (value: boolean) => void = () => { };
    const completionPromise = new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });

    // Setup Listeners FIRST (await them to avoid "remove does not exist" error)
    const onReward = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
      console.log('AdMob reward earned:', reward);
      resolvePromise(true);
      onReward.remove();
    });

    const onDismiss = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('AdMob ad dismissed');
      resolvePromise(false); // Resolve false if not already resolved (safe)
      onDismiss.remove();
      // Also remove onReward if it exists? 
      onReward.remove();
    });

    // Show Ad
    await AdMob.prepareRewardVideoAd(options);
    await AdMob.showRewardVideoAd();

    return completionPromise;

  } catch (error) {
    console.error('AdMob show failed', error);
    return false;
  }
};