import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { initDB } from './lib/db'

initDB();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'Outfit, Inter, sans-serif',
          fontWeight: 600,
          fontSize: '13px',
        },
      }}
    />
  </StrictMode>,
)