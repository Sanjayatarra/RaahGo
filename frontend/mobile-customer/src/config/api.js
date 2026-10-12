import { Platform } from 'react-native';

/**
 * RaahGo Customer Backend API Configuration
 * In Android Emulator: use 10.0.2.2
 * In iOS Simulator: use localhost
 * On Physical device via Expo Go: use your PC's Wi-Fi IP address (e.g. 192.168.1.100)
 */
export const DEV_BACKEND_IP = '192.168.137.1'; // Update to your PC's LAN IP if testing on physical phone

export const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return `http://${DEV_BACKEND_IP}:8000`;
  }
  return `http://localhost:8000`;
};

export const API_BASE_URL = getBaseUrl();
