export const fmtMoney = n => (n || 0).toLocaleString('ru-RU') + ' BYN'

export const initials = name =>
  (name || '').replace(/[«»"']/g, '').split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('')

// Handles both legacy (active/done) and API (in_progress/delivered/new) statuses
export const statusLabel = s => ({
  new: 'Новая', in_progress: 'В пути', active: 'В пути',
  delivered: 'Доставлено', done: 'Доставлено', cancelled: 'Отменено',
}[s] || s)

export const statusColor = s => ({
  new: '#8A93A0', in_progress: '#D97706', active: '#1366F0',
  delivered: '#1E9E5A', done: '#1E9E5A', cancelled: '#C81923',
}[s] || '#8A93A0')

export const statusBg = s => ({
  new: 'rgba(138,147,160,0.1)', in_progress: 'rgba(217,119,6,0.1)', active: 'rgba(19,102,240,0.1)',
  delivered: 'rgba(30,158,90,0.1)', done: 'rgba(30,158,90,0.1)', cancelled: 'rgba(200,25,35,0.1)',
}[s] || 'rgba(14,23,38,0.05)')

// Deterministic avatar gradient from any string (name, id, etc.)
const GRADIENTS = [
  ['#A5D8FF', '#1366F0'], ['#D0BFFF', '#7C3AED'], ['#B2F2BB', '#1E9E5A'],
  ['#FFD8B4', '#D97706'], ['#FFC9C9', '#C81923'], ['#FFE3B4', '#F47A1F'],
]
export const getGradient = str => {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}
