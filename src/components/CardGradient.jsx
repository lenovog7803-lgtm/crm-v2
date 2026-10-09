import GradientLayer from './GradientLayer'

// Живой градиент внутри главной карточки. Карточке даём className={`grad-card grad-${tone}`} —
// там заливка, рамка, тень (это же запасной вид без WebGL), а этот слой кладём первым ребёнком.
const TONES = {
  blue: ['#5B8BE0', '#8AB0F2', '#4269BF'],
  orange: ['#D4843F', '#E09A58', '#B9682A'],
  purple: ['#8164D4', '#9C84E3', '#6A4DBE'],
  green: ['#3E9F72', '#5DB88C', '#2A8058'],
  red: ['#D25E58', '#E07B75', '#B4443E'],
}

export default function CardGradient({ tone = 'blue' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: -1, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none' }}>
      <GradientLayer colors={TONES[tone]} speed={0.16} />
    </div>
  )
}
