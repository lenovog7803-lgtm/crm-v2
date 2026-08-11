export const STAGES = [
  { id: 'new',         label: 'Новый',         color: '#8A93A0', bg: 'rgba(138,147,160,0.10)', active: true },
  { id: 'reached',     label: 'Дозвонился',    color: '#1366F0', bg: 'rgba(19,102,240,0.10)',  active: true },
  { id: 'interested',  label: 'Заинтересован', color: '#1366F0', bg: 'rgba(19,102,240,0.10)',  active: true },
  { id: 'thinking',    label: 'Думает',        color: '#D97706', bg: 'rgba(217,119,6,0.12)',   active: true },
  { id: 'kp_sent',     label: 'КП отправлено', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)',  active: true },
  { id: 'negotiation', label: 'Переговоры',    color: '#7C3AED', bg: 'rgba(124,58,237,0.12)',  active: true },
  { id: 'won',         label: 'Клиент',        color: '#1E9E5A', bg: 'rgba(30,158,90,0.12)',   active: false },
  { id: 'no_contact',  label: 'Нет контакта',  color: '#8A93A0', bg: 'rgba(138,147,160,0.10)', active: false },
  { id: 'lost',        label: 'Отказ',         color: '#E0473B', bg: 'rgba(224,71,59,0.12)',   active: false },
]

export const OUTCOMES = [
  { id: 'no_answer',   label: 'Не взял трубку', color: '#8A93A0', needsComment: false },
  { id: 'reached',     label: 'Дозвонился',     color: '#1366F0', needsComment: true },
  { id: 'interested',  label: 'Заинтересован',  color: '#1366F0', needsComment: true },
  { id: 'thinking',    label: 'Думает',         color: '#D97706', needsComment: true },
  { id: 'kp_sent',     label: 'Отправил КП',    color: '#7C3AED', needsComment: true },
  { id: 'negotiation', label: 'Переговоры',     color: '#7C3AED', needsComment: true },
  { id: 'won',         label: 'Стал клиентом',  color: '#1E9E5A', needsComment: true },
  { id: 'lost',        label: 'Отказ',          color: '#E0473B', needsComment: true, needsReason: true },
]

export const LOST_REASONS = [
  'Дорого', 'Есть свой перевозчик', 'Не занимаемся логистикой',
  'Не тот профиль груза', 'Не наши направления', 'Просят не звонить',
  'Компания не работает', 'Другое',
]

export const DATE_PRESETS = [
  { label: 'Завтра', days: 1 },
  { label: '+3 дня', days: 3 },
  { label: '+неделя', days: 7 },
  { label: '+2 недели', days: 14 },
  { label: '+месяц', days: 30 },
]

export const DAILY_GOAL = 45

export const stageById = (id) => STAGES.find(s => s.id === id) || STAGES[0]
export const outcomeById = (id) => OUTCOMES.find(o => o.id === id)
