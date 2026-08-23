export const fmtMoney = n => (n || 0).toLocaleString('ru-RU') + ' BYN'

// A payment can be entered (PP number/date/amount saved on the order) without
// the paid boolean ever flipping true, if the sum of all entries for that
// side doesn't exactly match the order's rate (bank fee, rounding, wrong
// rate, typo) — the backend only sets client_paid/carrier_paid once the sum
// reconciles exactly. Left undetected, the order looks completely untouched
// ("unpaid") everywhere in the UI even though money was already sent, which
// is how a payment gets sent twice. Surfacing this distinctly is the fix.
export const hasUnreconciledPayment = (order, side) => {
  const paid = side === 'client' ? order.client_paid : order.carrier_paid
  if (paid) return false
  // Cash has no ПП to reconcile against a rate — never flag it.
  if (side === 'client' ? order.client_cash : order.carrier_cash) return false
  const payments = (side === 'client' ? order.client_payments : order.carrier_payments) || []
  const legacyPpNumber = side === 'client' ? order.client_pp_number : order.carrier_pp_number
  return !!legacyPpNumber || payments.some(p => (Number(p.amount) || 0) > 0 || (p.pp_number || '').trim())
}

// Display-only date formatter: "2026-08-18" or "2026-08-18T11:14:22Z" -> "18.08.2026".
// Never use this on values bound to <input type="date">, which require ISO.
export const fmtDate = d => {
  if (!d) return ''
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return d
  const [, y, mo, day] = m
  return `${day}.${mo}.${y}`
}

const LEGAL_FORMS = new Set(['ООО','ОАО','ЗАО','ПАО','АО','ИП','ЧУП','ЧПУП','УП','РУП','СООО','ОДО','КУП','РУПП','ТОО','СП','НП','ФЛ'])
export const initials = name => {
  const words = (name || '').replace(/[«»"']/g, '').split(/\s+/).filter(Boolean)
  const meaningful = words.filter(w => !LEGAL_FORMS.has(w.toUpperCase()))
  const source = meaningful.length > 0 ? meaningful : words
  return source.map(w => w[0].toUpperCase()).slice(0, 2).join('')
}

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
