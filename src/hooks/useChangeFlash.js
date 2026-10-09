import { useEffect, useRef, useState } from 'react'

// Какие записи списка только что изменились (живое обновление) — их строку подсвечиваем ~1.6 с.
// При первой загрузке ничего не подсвечивается.
// skip — Set с id, которые меняли сами (свою правку подсвечивать незачем).
export function useChangeFlash(items, signature, skip) {
  const prev = useRef(null)
  const [flash, setFlash] = useState(() => new Set())
  useEffect(() => {
    const now = new Map((items || []).map(it => [it.id, signature(it)]))
    if (prev.current) {
      const changed = [...now].filter(([id, sig]) => prev.current.has(id) && prev.current.get(id) !== sig).map(([id]) => id)
      const added = prev.current.size ? [...now.keys()].filter(id => !prev.current.has(id)) : []
      const ids = [...changed, ...added].filter(id => !skip?.current?.delete(id))
      if (ids.length) {
        setFlash(new Set(ids))
        const t = setTimeout(() => setFlash(new Set()), 1700)
        prev.current = now
        return () => clearTimeout(t)
      }
    }
    prev.current = now
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
  return flash
}
