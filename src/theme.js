import { useEffect, useState } from 'react'

// Тема: выбор пользователя (localStorage) или, если не выбирал, — как в системе.
const KEY = 'crm-theme'
const dark = window.matchMedia('(prefers-color-scheme: dark)')
const saved = () => { try { return localStorage.getItem(KEY) } catch { return null } }
export const currentTheme = () => saved() || (dark.matches ? 'dark' : 'light')
export const applyTheme = () => { document.documentElement.dataset.theme = currentTheme() }

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme)
  useEffect(() => {
    const sync = () => { applyTheme(); setTheme(currentTheme()) }
    dark.addEventListener('change', sync)
    window.addEventListener('crm:theme', sync)
    return () => { dark.removeEventListener('change', sync); window.removeEventListener('crm:theme', sync) }
  }, [])
  const toggle = () => {
    try { localStorage.setItem(KEY, theme === 'dark' ? 'light' : 'dark') } catch { /* приватный режим — тема до перезагрузки */ document.documentElement.dataset.theme = theme === 'dark' ? 'light' : 'dark' }
    window.dispatchEvent(new Event('crm:theme'))
  }
  return [theme, toggle]
}
