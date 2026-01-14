import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.guandan.master',
  appName: 'AI 掼蛋大师',
  webDir: 'dist', // Vite outputs to 'dist', not 'www'
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // ScreenOrientation lock removed to allow auto-rotation
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true
    }
  }
};

export default config;