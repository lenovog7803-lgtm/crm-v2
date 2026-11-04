import { useState } from 'react'

// Временная панель выбора палитры — только при локальном запуске (vite dev), на сайт не попадает.
const OPTIONS = [['', 'Исходная'], ['apple', 'Apple'], ['sky', 'Небо'], ['graphite', 'Графит'], ['warm', 'Тёплая']]
export const applyPalette = () => { document.documentElement.dataset.palette = localStorage.getItem('crm-palette') || '' }

export default function PalettePicker() {
  const [cur, setCur] = useState(() => localStorage.getItem('crm-palette') || '')
  const pick = v => { localStorage.setItem('crm-palette', v); setCur(v); applyPalette() }
  return (
    <div className="palette-picker" role="group" aria-label="Палитра">
      {OPTIONS.map(([v, label]) => <button key={v} type="button" aria-pressed={cur === v} onClick={() => pick(v)}>{label}</button>)}
    </div>
  )
}
