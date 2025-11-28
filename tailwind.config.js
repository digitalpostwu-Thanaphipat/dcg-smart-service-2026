/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6A2C70",
        secondary: "#B83B5E",
        accent: "#F08A5D",
        background: "#F9F7F7",
      }
    },
  },
  plugins: [],
}