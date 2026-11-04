import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyTheme } from './theme'

applyTheme()  // до первого кадра — без вспышки светлой темы

// iOS Safari включает :active (подсветку нажатия) только если на странице есть touchstart-слушатель
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
