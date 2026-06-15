export const API_URL = (import.meta as any).env?.DEV
  ? '/api/exec'
  : ((import.meta as any).env?.VITE_API_URL || "https://script.google.com/macros/s/AKfycbwSosmXqRi1ByBBMo5h06JkIn0Zc1x4NI9at-btDns8obmcAHuNSCwTNFUwlgpNJqiczw/exec");

export const APP_NAME = "DCG Smart Service";
export const APP_VERSION = "v1.0.0";     // เพิ่มเวอร์ชัน