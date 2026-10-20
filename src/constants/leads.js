export const STAGES = [
  { id: 'new',         label: 'Новый',         color: 'var(--text-3)', bg: 'rgba(138,147,160,0.10)', active: true },
  { id: 'callback',    label: 'Перезвонить',   color: 'var(--fg-1366f0)', bg: 'rgba(var(--rgb-19-102-240), 0.10)',  active: true },
  { id: 'thinking',    label: 'Думает',        color: 'var(--fg-d97706)', bg: 'rgba(var(--rgb-217-119-6), 0.12)',   active: true },
  { id: 'kp_sent',     label: 'КП отправлено', color: 'var(--fg-7c3aed)', bg: 'rgba(var(--rgb-124-58-237), 0.12)',  active: true },
  { id: 'won',         label: 'Клиент',        color: 'var(--fg-1e9e5a)', bg: 'rgba(var(--rgb-30-158-90), 0.12)',   active: false },
  { id: 'lost',        label: 'Отказ',         color: 'var(--fg-e0473b)', bg: 'rgba(var(--rgb-224-71-59), 0.12)',   active: false },
]
// этапы прежней воронки — где лид ещё лежит со старым этапом, показываем его в новом
export const LEGACY_STAGE = { reached: 'callback', interested: 'thinking', negotiation: 'kp_sent', no_contact: 'lost' }
export const stageOf = (lead) => { const s = lead?.stage || 'new'; return LEGACY_STAGE[s] || s }

export const OUTCOMES = [
  { id: 'no_answer',   label: 'Не взял трубку', color: 'var(--text-3)', needsComment: false },
  { id: 'callback',    label: 'Перезвонить',    color: 'var(--fg-1366f0)', needsComment: false },
  { id: 'thinking',    label: 'Думает',         color: 'var(--fg-d97706)', needsComment: true },
  { id: 'kp_sent',     label: 'Отправил КП',    color: 'var(--fg-7c3aed)', needsComment: true },
  { id: 'won',         label: 'Стал клиентом',  color: 'var(--fg-1e9e5a)', needsComment: true },
  { id: 'lost',        label: 'Отказ',          color: 'var(--fg-e0473b)', needsComment: true, needsReason: true },
]

export const LOST_REASONS = [
  'Дорого', 'Есть свой перевозчик', 'Не занимаемся логистикой',
  'Не тот профиль груза', 'Не наши направления', 'Просят не звонить',
  'Компания не работает', 'Не дозвонились', 'Другое',
]

export const DATE_PRESETS = [
  { label: 'Завтра', days: 1 },
  { label: '+3 дня', days: 3 },
  { label: '+неделя', days: 7 },
  { label: '+2 недели', days: 14 },
  { label: '+месяц', days: 30 },
]

export const DAILY_GOAL = 45

export const stageById = (id) => STAGES.find(s => s.id === (LEGACY_STAGE[id] || id)) || STAGES[0]
export const outcomeById = (id) => OUTCOMES.find(o => o.id === id)
