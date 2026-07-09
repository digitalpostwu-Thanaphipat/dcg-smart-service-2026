const isDev = (import.meta as any).env?.DEV;
const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
const appEnv = (import.meta as any).env?.VITE_APP_ENV || 'production';

// Production fallback URL - ใช้เฉพาะ production เท่านั้น
const PRODUCTION_FALLBACK = "https://script.google.com/macros/s/AKfycbwSosmXqRi1ByBBMo5h06JkIn0Zc1x4NI9at-btDns8obmcAHuNSCwTNFUwlgpNJqiczw/exec";

// Determine API URL based on environment
let apiUrl: string;

if (isDev) {
  // Development mode: use local proxy
  apiUrl = '/api/exec';
} else if (viteApiUrl) {
  // Staging/Preview/Production: use explicit env variable
  apiUrl = viteApiUrl;
} else if (appEnv === 'staging') {
  // Staging without API URL: fail fast to prevent silent production fallback
  throw new Error(
    '[DCG Smart Service] FATAL: VITE_API_URL is required in staging mode. ' +
    'Set it in Vercel Preview environment variables or .env.staging file.'
  );
} else {
  // Production fallback
  apiUrl = PRODUCTION_FALLBACK;
}

export const API_URL = apiUrl;
export const APP_NAME = "DCG Smart Service";
export const APP_VERSION = "v1.0.0";
export const APP_ENV = appEnv;