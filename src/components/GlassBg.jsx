import { Glass } from 'glisse'

// Фон-стекло для панелей слоя управления (боковое меню, шапка) — компонент Glass из glisse
// с настройками как на демо: Bend 0.46, Dispersion 0, Frost 6px, Rim 0.21. Лежит под содержимым панели.
const STYLE = {
  position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: -1, pointerEvents: 'none',
  '--lg-glass-bend': 0.46, '--lg-glass-dispersion': 0, '--lg-blur': '6px', '--lg-rim-shine': 0.21,
}
export default function GlassBg() {
  return <Glass aria-hidden="true" className="glass-bg" style={STYLE} />
}
