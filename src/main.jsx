import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './palette.css'
import App from './App.jsx'
import PalettePicker, { applyPalette } from './components/PalettePicker'
import { applyTheme } from './theme'

applyTheme(); applyPalette()  // до первого кадра — без вспышки светлой темы

// iOS Safari включает :active (подсветку нажатия) только если на странице есть touchstart-слушатель
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {import.meta.env.DEV && <PalettePicker />}
  </StrictMode>,
)
