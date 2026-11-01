import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.grimorio.dndcompanion',
  appName: 'Di en Di',
  webDir: 'dist',
  server: { androidScheme: 'https', cleartext: true },
  android: {
    backgroundColor: '#15110f',
    // Permite conectar con el servidor de partida por ws:// en la Wi-Fi de casa
    allowMixedContent: true,
  },
};

export default config;
