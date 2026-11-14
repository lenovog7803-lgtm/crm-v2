import { logCall, convertLead } from '../../api'
import { iosConfirm } from '../IOSAlert'

export const SAVE_ERROR = 'Звонок не сохранился. Проверьте интернет и нажмите ещё раз.'

// Запись звонка — одна на Очередь, Список и Канбан: салют при «Стал клиентом» и вопрос про карточку клиента.
// Ошибку не глотает — её показывает блок результата.
export async function saveCall(lead, data, celebrate) {
  const res = await logCall(lead.id, data)
  if (data.outcome === 'won') celebrate?.()
  if (res.ask_create_client && await iosConfirm(`Создать карточку клиента? ${lead.name} стал клиентом — перенести в раздел «Клиенты»?`, { cancelLabel: 'Нет' })) {
    try { await convertLead(lead.id) } catch (e) { console.error(e) }
  }
  return res
}

// дата для <input type="datetime-local"> в местном времени (toISOString дал бы UTC — минус 3 часа)
export function localDateTime(daysAhead, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(hour)}:00`
}
