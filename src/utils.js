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
  new: 'var(--text-3)', in_progress: 'var(--fg-d97706)', active: 'var(--fg-1366f0)',
  delivered: 'var(--fg-1e9e5a)', done: 'var(--fg-1e9e5a)', cancelled: 'var(--fg-c81923)',
}[s] || 'var(--text-3)')

export const statusBg = s => ({
  new: 'rgba(138,147,160,0.1)', in_progress: 'rgba(var(--rgb-217-119-6), 0.1)', active: 'rgba(var(--rgb-19-102-240), 0.1)',
  delivered: 'rgba(var(--rgb-30-158-90), 0.1)', done: 'rgba(var(--rgb-30-158-90), 0.1)', cancelled: 'rgba(var(--rgb-200-25-35), 0.1)',
}[s] || 'rgba(var(--ink-rgb), 0.05)')

// Deterministic avatar gradient from any string (name, id, etc.)
// цвета — в index.css (--av-N-a/b): в тёмной теме приглушённые пастельные
const GRADIENTS = [0, 1, 2, 3, 4, 5].map(i => [`var(--av-${i}-a)`, `var(--av-${i}-b)`])
export const getGradient = str => {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}

// Попадает ли дата в период из выбора «Текущий месяц / Прошлый / Квартал / Год / Всё время / 2026-10 / 2026-Q3».
export function inPeriod(raw, period) {
  if (period === 'all') return true
  if (!raw) return false
  const d = new Date(raw)
  if (isNaN(d)) return false
  const now = new Date()
  if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (period === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
  }
  if (period === 'quarter') return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear()
  if (period === 'year') return d.getFullYear() === now.getFullYear()
  if (/^\d{4}-\d{2}$/.test(period)) return String(raw).slice(0, 7) === period
  if (/^\d{4}-Q[1-4]$/.test(period)) return d.getFullYear() === parseInt(period.slice(0, 4), 10) && Math.floor(d.getMonth() / 3) + 1 === parseInt(period.slice(6), 10)
  return true
}

export const BY_BANKS = {
  AKBB: { bik: 'AKBBBY2X', name: 'ОАО «АСБ Беларусбанк»' },
  BAPB: { bik: 'BAPBBY2X', name: 'ОАО «Белагропромбанк»' },
  BELB: { bik: 'BELBBY2X', name: 'ОАО «Белинвестбанк»' },
  BBRB: { bik: 'BBRBBY2X', name: 'ОАО «Белгазпромбанк»' },
  PJCB: { bik: 'PJCBBY2X', name: 'ОАО «Приорбанк»' },
  ALFA: { bik: 'ALFABY2X', name: 'ЗАО «Альфа-Банк»' },
  SLAN: { bik: 'SLANBY22', name: 'ОАО «Сбер Банк»' },
  MTBK: { bik: 'MTBKBY22', name: 'ЗАО «МТБанк»' },
  VTBZ: { bik: 'VTBZBY2X', name: 'ЗАО «Банк ВТБ (Беларусь)»' },
  BMTB: { bik: 'BMTBBY22', name: 'ЗАО «БНБ-Банк»' },
  BLBB: { bik: 'BLBBBY2X', name: 'ЗАО «БСБ Банк»' },
  PARB: { bik: 'PARBBY2X', name: 'ОАО «Паритетбанк»' },
  TEHN: { bik: 'TEHNBY22', name: 'ОАО «Технобанк»' },
  PBSU: { bik: 'PBSUBY22', name: 'ОАО «Банк Дабрабыт»' },
  RSHB: { bik: 'RSHBBY2X', name: 'ЗАО «РРБ-Банк»' },
  STBK: { bik: 'STBKBY22', name: 'ЗАО «СтатусБанк»' },
  BLNB: { bik: 'BLNBBY2X', name: 'ЗАО «Нео Банк Азия»' },
  ZBRB: { bik: 'ZBRBBY22', name: 'ЗАО «Цептер Банк»' },
  TGBP: { bik: 'TGBPBY2X', name: 'ЗАО «ТК Банк»' },
  NBRB: { bik: 'NBRBBY2X', name: 'Национальный банк Республики Беларусь' },
  POBN: { bik: 'POBNBY2X', name: 'ЗАО «ОптиКурс» НКФО' },
  ERPB: { bik: 'ERPBBY22', name: 'ЗАО «ЕРПБ»' },
  REHB: { bik: 'REHBBY2X', name: 'ОАО «Банк развития Республики Беларусь»' },
}

export const RU_BANKS = {
  '044525225': 'ПАО Сбербанк',
  '044525974': 'АО «ТБанк»',
  '044525593': 'АО «Альфа-Банк»',
  '044525411': 'Филиал «Центральный» Банка ВТБ (ПАО)',
  '044525187': 'Банк ВТБ (ПАО)',
  '044525700': 'АО «Райффайзенбанк»',
  '044525823': 'Банк ГПБ (АО)',
  '044525092': 'ООО «Банк Точка»',
  '044525104': 'ООО «ОЗОН Банк»',
  '044525388': 'ПАО «Совкомбанк»',
  '044525600': 'ПАО «Промсвязьбанк»',
  '044525201': 'АО «АБ «РОССИЯ»',
  '044030653': 'ПАО Сбербанк (Северо-Западный банк)',
  '044030706': 'АО «Альфа-Банк» (Санкт-Петербург)',
}

// Автоматическое определение БИК и Банка по номеру расчетного счета (IBAN)
export function findBankByAccount(acc) {
  if (!acc) return null
  const clean = String(acc).replace(/[\s\-_]/g, '').toUpperCase()
  const m = clean.match(/^BY\d{2}([A-Z]{4})/)
  if (m) {
    const code = m[1]
    const info = BY_BANKS[code]
    if (info) {
      return { bik: info.bik, bank: info.name, code }
    }
  }
  return null
}

// Автоматическое определение Банка по БИК (белорусский или российский)
export function findBankByBik(bik) {
  if (!bik) return null
  const clean = String(bik).replace(/[\s\-_]/g, '').toUpperCase()
  for (const [code, info] of Object.entries(BY_BANKS)) {
    if (clean === code || clean.startsWith(info.bik.slice(0, 8)) || clean === info.bik) {
      return { bik: info.bik, bank: info.name, code }
    }
  }
  if (RU_BANKS[clean]) {
    return { bik: clean, bank: RU_BANKS[clean] }
  }
  return null
}

// Автоформатирование номера телефона (+375 (29) 123-45-67 или +7 (999) 123-45-67)
export function formatPhone(val) {
  if (!val) return ''
  let digits = String(val).replace(/\D/g, '')
  if (!digits) return val

  // Беларусь (код 375 или внутренний 80)
  if (digits.startsWith('80') && digits.length === 11) {
    digits = '375' + digits.slice(2)
  } else if (digits.length === 9 && (digits.startsWith('29') || digits.startsWith('44') || digits.startsWith('33') || digits.startsWith('25') || digits.startsWith('17'))) {
    digits = '375' + digits
  }
  if (digits.startsWith('375') && digits.length === 12) {
    return `+375 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`
  }

  // Россия (код 7 или 8)
  if ((digits.startsWith('7') || digits.startsWith('8')) && digits.length === 11) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }

  return val
}

// Форматирование счета (IBAN) блоками по 4 символа (BY20 AKBB 3012 1234 5678 9000 0000)
export function formatIBAN(val) {
  if (!val) return ''
  const clean = String(val).replace(/[\s\-_]/g, '').toUpperCase()
  if (clean.startsWith('BY') && clean.length <= 28) {
    return clean.replace(/(.{4})/g, '$1 ').trim()
  }
  return clean
}

function isBankName(str) {
  if (!str) return false
  return /банк|bank|сбер|беларусбанк|белагропромбанк|приорбанк|втб|мтбанк|альфа-банк|технобанк|в\s+банке|в\s+цбу|в\s+филиале/i.test(str)
}

// Парсер текста реквизитов (из письма, карточки предприятия, документа)
export function parseRequisites(raw, kind = 'client') {
  const res = {}
  if (!raw || typeof raw !== 'string') return res

  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // 1. УНП / ИНН (9 цифр для РБ, 10 или 12 для РФ)
  const unpLabel = raw.match(/(?:УНП|УНН|ИНН)[\s:№#]*([0-9]{9,12})/i)
  if (unpLabel) {
    res.unp = unpLabel[1]
  } else {
    const unpAlone = raw.match(/\b([1-7]\d{8})\b/)
    if (unpAlone) res.unp = unpAlone[1]
  }

  // 2. Расчетный счет (IBAN или 20 цифр)
  const ibanMatch = raw.match(/(BY\d{2}\s*[A-Z]{4}\s*[\dA-Z\s]{16,24})/i) || raw.match(/\b(40[5-8]\d{17})\b/)
  if (ibanMatch) {
    const rawAcc = ibanMatch[1].replace(/\s+/g, '').toUpperCase()
    res.account = formatIBAN(rawAcc)
    const bankInfo = findBankByAccount(rawAcc)
    if (bankInfo) {
      res.bik = bankInfo.bik
      res.bank = bankInfo.bank
    }
  }

  // 3. БИК (если не определен по счету)
  if (!res.bik) {
    const bikMatch = raw.match(/(?:БИК|BIC|SWIFT)[\s:№#]*([A-Z0-9]{8,11}|\d{9})/i)
    if (bikMatch) {
      res.bik = bikMatch[1].toUpperCase()
      const bInfo = findBankByBik(res.bik)
      if (bInfo && !res.bank) res.bank = bInfo.bank
    }
  }

  // 4. Банк (если еще не определен)
  if (!res.bank) {
    const bankLine = lines.find(l => /(?:^|\s)(?:банк|в\s+банке|наименование\s+банка)[\s:–—]/i.test(l))
    if (bankLine) {
      const bClean = bankLine.replace(/^(?:банк|в\s+банке|наименование\s+банка)[\s:–—]*/i, '').trim()
      if (bClean) res.bank = bClean
    } else {
      const bankMatch = raw.match(/(?:в\s+)?((?:ОАО|ЗАО|ПАО|АО|АКБ)?\s*[«"'][^»"'\n]*(?:банк|Bank)[^»"'\n]*[»"'])/i)
      if (bankMatch) res.bank = bankMatch[1].trim()
    }
  }

  // 5. Название организации (Клиент / Перевозчик) - СТРОГО НЕ БАНК!
  for (const l of lines) {
    const labelMatch = l.match(/^(?:Организация|Компания|Наименование(?:\s*организации|\s*предприятия|\s*клиента|\s*перевозчика)?|Клиент|Перевозчик|Фирма)[\s:–—]+(.+)$/i)
    if (labelMatch) {
      const candidate = labelMatch[1].trim()
      if (!isBankName(candidate)) {
        res.name = candidate
        break
      }
    }
  }

  if (!res.name) {
    for (const l of lines) {
      if (isBankName(l) || /^(?:карточка|реквизиты|р\/с|счет|счёт|iban|бик|bic|унп|инн|тел|email)/i.test(l)) continue

      // Полные формы юрлиц (Частное предприятие, Унитарное предприятие, ООО, ЗАО...) с кавычками
      const fullOrgMatch = l.match(/((?:Частное\s+[^\n«"']*предприятие|Общество\s+с\s+ограниченной\s+ответственностью|Закрытое\s+акционерное\s+общество|Открытое\s+акционерное\s+общество|Публичное\s+акционерное\s+общество|Унитарное\s+предприятие|ООО|ОАО|ЗАО|ЧТУП|ЧТПУП|ЧУП|ЧПУП|УП|РУП|СООО|ОДО|ПАО|АО|ИП)\s*[«"'][^»"'\n]+[»"'])/i)
      if (fullOrgMatch && !isBankName(fullOrgMatch[1])) {
        res.name = fullOrgMatch[1].trim()
        break
      }

      // ИП / Индивидуальный предприниматель
      const ipMatch = l.match(/((?:ИП|Индивидуальный\s*предприниматель)\s+[А-Яа-яЁёA-Za-z\.\-\s]+)/i)
      if (ipMatch) {
        let cand = ipMatch[1].split(/[,;\n]|УНП|ИНН/i)[0].trim()
        if (cand && !isBankName(cand)) {
          res.name = cand
          break
        }
      }

      // Юрлица с кавычками: ООО "...", ОАО "..."
      const orgQuotes = l.match(/((?:ООО|ОАО|ЗАО|ЧУП|ЧПУП|УП|РУП|СООО|ОДО|ПАО|АО)\s*[«"'][^»"'\n]+[»"'])/i)
      if (orgQuotes && !isBankName(orgQuotes[1])) {
        res.name = orgQuotes[1].trim()
        break
      }

      // Юрлица без кавычек: ООО Название
      const orgPlain = l.match(/((?:ООО|ОАО|ЗАО|ЧУП|ЧПУП|УП|РУП|СООО|ОДО|ПАО|АО)\s+[А-Яа-яЁёA-Za-z0-9\-_]+)/i)
      if (orgPlain && !isBankName(orgPlain[1])) {
        res.name = orgPlain[1].trim()
        break
      }
    }
  }

  // Если не найдено по шаблонам, проверяем самую первую строку с кавычками
  if (!res.name && lines[0] && /[«"'][^»"'\n]+[»"']/.test(lines[0]) && !isBankName(lines[0])) {
    res.name = lines[0].trim()
  }

  // 6. Директор / Руководитель
  const dirMatch = raw.match(/(?:Директор|Ген(?:\.|еральный)?\s*директор|Руководитель)[\s:–—]*([А-Яа-яЁё\s\.]+?)(?:,|\n|действует|$)/i)
  if (dirMatch) res.director = dirMatch[1].trim()

  // 7. Основание
  if (/свидетельств/i.test(raw)) res.basis = 'Свидетельства о гос. регистрации'
  else if (/устав/i.test(raw)) res.basis = 'Устава'

  // 8. Телефон (исключаем совпадения внутри номера расчетного счета!)
  let rawNoAcc = raw
  if (res.account) rawNoAcc = rawNoAcc.replace(res.account.replace(/\s+/g, ''), '')
  if (ibanMatch) rawNoAcc = rawNoAcc.replace(ibanMatch[0], '')

  const phoneLabel = rawNoAcc.match(/(?:тел(?:ефон|\.)?|моб(?:\.|ильный)?|контактный\s*телефон)[\s:–—]*([+\d\s\-()]{7,25})/i)
  if (phoneLabel) {
    res.phone = formatPhone(phoneLabel[1].trim())
  } else {
    const phoneBY = rawNoAcc.match(/(?:\+375|80)[\s\-()]*\d{2}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/)
    const phoneRU = rawNoAcc.match(/(?:\+7|8)[\s\-()]*[1-9]\d{2}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/)
    if (phoneBY) res.phone = formatPhone(phoneBY[0].trim())
    else if (phoneRU) res.phone = formatPhone(phoneRU[0].trim())
  }

  // 9. Email
  const mailMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  if (mailMatch) res.email = mailMatch[1]

  // 10. Юридический и почтовый адреса (строго без путаницы с УНП или р/с)
  for (const l of lines) {
    if (/^(?:Юр(?:\.|идический)?\s*адрес|Адрес(?:\s*местонахождения)?)[\s:–—]/i.test(l)) {
      res.legal_address = l.replace(/^(?:Юр(?:\.|идический)?\s*адрес|Адрес(?:\s*местонахождения)?)[\s:–—]*/i, '').trim()
    } else if (/^Почт(?:\.|овый)?\s*адрес[\s:–—]/i.test(l)) {
      res.postal_address = l.replace(/^Почт(?:\.|овый)?\s*адрес[\s:–—]*/i, '').trim()
    }
  }
  if (!res.legal_address) {
    const addrLine = lines.find(l => /(?:^|\s)(?:г\.\s*[А-Яа-яЁё]+|город\s+[А-Яа-яЁё]+|г\s+[А-Яа-яЁё]+)[,\s]+(?:ул\.|улица|пр\.|проспект|пер\.|тракт)/i.test(l))
    if (addrLine && !isBankName(addrLine)) res.legal_address = addrLine.trim()
  }

  // 11. Для перевозчика (контактное лицо, ТС, прицеп, водитель, паспорт, телефон)
  if (kind === 'carrier') {
    // Контактное лицо (менеджер, диспетчер, логист)
    const contactLine = lines.find(l => /(?:контактное\s*лицо|контакт|менеджер|диспетчер|логист)[\s:–—]/i.test(l))
    if (contactLine) {
      let cp = contactLine.replace(/^(?:контактное\s*лицо|контакт|менеджер|диспетчер|логист)[\s:–—]*/i, '').trim()
      cp = cp.split(/(?:,|\s*\+|тел|моб|\d{7,})/i)[0].trim()
      if (cp) res.contact_person = cp
      const cPhone = contactLine.match(/([+\d\s\-()]{7,25})/)
      if (cPhone) res.contact_phone = formatPhone(cPhone[1].trim())
    }
    if (!res.contact_person && res.director) {
      res.contact_person = res.director
    }

    // Водитель (ФИО)
    let driverName = ''
    let driverIndex = -1
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (/^(?:водитель|фио\s*водителя)[\s:–—]/i.test(l)) {
        let d = l.replace(/^(?:водитель|фио\s*водителя)[\s:–—]*/i, '').trim()
        d = d.split(/(?:,|\s*\+|тел|моб|пасп|\d{7,})/i)[0].trim()
        if (d) {
          driverName = d
          res.driver_name = d
          driverIndex = i
          break
        }
      }
    }

    // Паспортные данные водителя и кем выдан
    let passportNum = ''
    let passportIssued = ''
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (/^(?:паспорт(?:\s*данные)?|пасп(?:\.|\s*данные)?|в\/у|водительское\s*удостоверение)[\s:–—]/i.test(l)) {
        passportNum = l.replace(/^(?:паспорт(?:\s*данные)?|пасп(?:\.|\s*данные)?|в\/у|водительское\s*удостоверение)[\s:–—]*/i, '').trim()
      } else if (/^выдан[\s:–—]/i.test(l)) {
        passportIssued = l.trim()
      } else if (/^(?:кем\s*выдан|орган\s*выдачи)[\s:–—]/i.test(l)) {
        passportIssued = 'Выдан ' + l.replace(/^(?:кем\s*выдан|орган\s*выдачи)[\s:–—]*/i, '').trim()
      }
    }

    // Автомобиль, марка, прицеп
    let autoModel = ''
    let trailerModel = ''
    let autoPlate = ''
    let trailerPlate = ''

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (/^(?:авто|автомобиль|тягач|машина|тс|марка(?:\s*тс)?)[\s:–—]/i.test(l)) {
        let clean = l.replace(/^(?:авто|автомобиль|тягач|машина|тс|марка(?:\s*тс)?)[\s:–—]*/i, '').trim()
        const parts = clean.split(/(?:\/|прицеп|полуприцеп|п\/п|п-пр)/i)
        autoModel = parts[0].trim()
        if (parts.length > 1 && parts[1].trim()) trailerModel = parts[1].trim()
      }
      if (/^(?:прицеп|полуприцеп|п\/п|п-пр)[\s:–—]/i.test(l)) {
        trailerModel = l.replace(/^(?:прицеп|полуприцеп|п\/п|п-пр)[\s:–—]*/i, '').trim()
      }
      if (/^(?:гос\.?\s*номер|номер\s*тс|рег\.?\s*знак|номер\s*машины)[\s:–—]/i.test(l)) {
        let clean = l.replace(/^(?:гос\.?\s*номер|номер\s*тс|рег\.?\s*знак|номер\s*машины)[\s:–—]*/i, '').trim()
        const parts = clean.split(/(?:\/|прицеп|полуприцеп|п\/п|п-пр)/i)
        autoPlate = parts[0].trim()
        if (parts.length > 1 && parts[1].trim()) trailerPlate = parts[1].trim()
      }
    }

    // Если номера не найдены по метке гос. номер, ищем по регулярным выражениям номеров
    if (!autoPlate) {
      const plateMatch = raw.match(/\b\d{4}\s*[A-ZА-Я]{2}(?:-[1-7]|\s+[1-7])\b|\b[A-ZА-Я]{2}\s*\d{4}(?:-[1-7]|\s+[1-7])\b|\b[АВЕКМНОРСТУХA-Z]\s*\d{3}\s*[АВЕКМНОРСТУХA-Z]{2}\s*\d{2,3}\b/i)
      if (plateMatch) autoPlate = plateMatch[0].trim()
    }

    // Сохраняем plate
    if (autoPlate && trailerPlate && !autoPlate.includes(trailerPlate)) {
      res.plate = `${autoPlate} / ${trailerPlate}`
    } else if (autoPlate) {
      res.plate = autoPlate
    } else if (trailerPlate) {
      res.plate = trailerPlate
    }

    // Базовый тип ТС
    let baseType = ''
    if (/реф(?:рижератор)?/i.test(raw)) baseType = 'Рефрижератор'
    else if (/изотерм|термос/i.test(raw)) baseType = 'Изотермический'
    else if (/тент|штор|мега|jumbo/i.test(raw)) baseType = 'Тент'
    else if (/цельномет/i.test(raw)) baseType = 'Цельнометаллический'
    else if (/сцепк/i.test(raw)) baseType = 'Сцепка'
    else if (/контейнер/i.test(raw)) baseType = 'Контейнеровоз'
    else if (/площадк/i.test(raw)) baseType = 'Площадка'
    else if (/борт/i.test(raw)) baseType = 'Бортовой'
    else if (/цистерн/i.test(raw)) baseType = 'Автоцистерна'
    else if (/самосвал/i.test(raw)) baseType = 'Самосвал'

    // Грузоподъемность (т)
    const tonsMatch = raw.match(/(?:^|\s|[^\d.,])(\d{1,2}(?:[.,]\d+)?)\s*(?:т|тонн|тн)(?:\s|[.,;]|\n|$)/i)
    if (tonsMatch) {
      res.capacity_tons = tonsMatch[1].replace(',', '.')
    }

    // Телефон(ы) водителя (включая ру номер)
    let driverPhones = []
    if (driverIndex !== -1) {
      for (let i = driverIndex; i < Math.min(lines.length, driverIndex + 6); i++) {
        const l = lines[i]
        const phones = l.match(/(?:\+375|80|\+7|8)[\s\-()]*\d{2,3}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g)
        if (phones) {
          phones.forEach(p => {
            const cleaned = p.trim()
            if (!driverPhones.includes(cleaned)) driverPhones.push(cleaned)
          })
        } else if (/^\+?\d{11,12}$/.test(l.replace(/[\s\-()]/g, ''))) {
          const cleaned = l.trim()
          if (!driverPhones.includes(cleaned)) driverPhones.push(cleaned)
        }
      }
    }

    // Форматируем vehicle_type построчно точно по эталону:
    // Авто: [марка] / [прицеп]
    // Гос. номер: [тягач] / [прицеп]
    // Водитель: [ФИО]
    // Паспорт: [серия номер]
    // Выдан [орган дата]
    // [телефоны через / ]
    const vehicleLines = []
    if (autoModel) {
      vehicleLines.push('Авто: ' + autoModel + (trailerModel ? ' / ' + trailerModel : ''))
    } else if (baseType) {
      vehicleLines.push('Авто: ' + baseType + (res.capacity_tons ? ' ' + res.capacity_tons + 'т' : '') + (trailerModel ? ' / ' + trailerModel : ''))
    }
    if (res.plate) {
      vehicleLines.push('Гос. номер: ' + res.plate)
    }
    if (driverName) {
      vehicleLines.push('Водитель: ' + driverName)
    }
    if (passportNum) {
      vehicleLines.push('Паспорт: ' + passportNum)
    }
    if (passportIssued) {
      vehicleLines.push(passportIssued)
    }
    if (driverPhones.length > 0) {
      vehicleLines.push(driverPhones.join(' / '))
    }

    if (vehicleLines.length > 0) {
      res.vehicle_type = vehicleLines.join('\n')
    } else if (baseType) {
      res.vehicle_type = baseType
    }
  }

  return res
}

