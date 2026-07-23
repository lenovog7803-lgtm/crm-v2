import { useState } from 'react'

export function usePersistedSearch(key, defaultValue = '') {
  const [search, setSearch] = useState(() => {
    try {
      return localStorage.getItem(key) || defaultValue
    } catch {
      return defaultValue
    }
  })

  const updateSearch = value => {
    setSearch(value)
    try {
      if (value) {
        localStorage.setItem(key, value)
      } else {
        localStorage.removeItem(key)
      }
    } catch {}
  }

  return [search, updateSearch]
}
