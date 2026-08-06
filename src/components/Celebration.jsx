import { createContext, useContext, useState, useCallback } from 'react'
import { CelebrationBurst } from './CelebrationBurst'

const CelebrationContext = createContext(null)

export function CelebrationProvider({ children }) {
  const [trigger, setTrigger] = useState(0)

  const celebrate = useCallback(() => {
    setTrigger(t => t + 1)
  }, [])

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      <CelebrationBurst trigger={trigger} onDone={() => {}} />
    </CelebrationContext.Provider>
  )
}

export const useCelebration = () => useContext(CelebrationContext)
