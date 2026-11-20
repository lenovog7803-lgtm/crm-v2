// Генерация готового B2B коммерческого предложения (КП) А2 Group
// под нишу клиента (WB/Ozon или B2B FTL/LTL перевозки)

export function getProposalText(lead) {
  if (!lead) return ''

  const isWbOzon =
    lead.funnel === 'WB_OZON' ||
    (lead.industry && (lead.industry.includes('WB') || lead.industry.includes('Ozon') || lead.industry.includes('Селлер'))) ||
    (lead.niche && (lead.niche.includes('WB') || lead.niche.includes('Ozon') || lead.niche.includes('Маркетплейс')))

  if (isWbOzon) {
    return `Здравствуйте! Логистическая компания А2 Group.

Доставляем сборные грузы и паллеты из Беларуси на склады Wildberries и Ozon (Коледино, Электросталь, Подольск, Казань, Тула и др.):

• Регулярные рейсы 3 раза в неделю из Минска
• Сдача без очередей, помощь с пропусками и маркировкой
• 100% страхование груза и официальный договор
• Персональный логист и отслеживание статуса

Подскажите, на какие склады маркетплейсов сейчас возите чаще всего? Рассчитаем точную стоимость под вашу поставку.`
  }

  return `Здравствуйте! Логистическая компания А2 Group.

Осуществляем регулярные автоперевозки Беларусь ↔ Россия (FTL / LTL, от 1 паллеты до 20 тонн):

• Маршруты: Минск ↔ Москва, Санкт-Петербург, регионы РФ и Урал
• Быстрая подача транспорта под загрузку (тенты, рефрижераторы, изотермы)
• Фиксированная ставка без скрытых доплат, полное страхование груза и договор
• Персональный менеджер и контроль на каждом этапе рейса

Подскажите, какие направления и объемы отгрузок для вас сейчас актуальны? Подготовим индивидуальный расчет ставок.`
}

export function getFollowUpText(lead) {
  if (!lead) return ''

  const isWbOzon =
    lead.funnel === 'WB_OZON' ||
    (lead.industry && (lead.industry.includes('WB') || lead.industry.includes('Ozon') || lead.industry.includes('Селлер'))) ||
    (lead.niche && (lead.niche.includes('WB') || lead.niche.includes('Ozon') || lead.niche.includes('Маркетплейс')))

  if (isWbOzon) {
    return `Здравствуйте! Логистическая компания А2 Group.

Подскажите, пожалуйста, удалось ли посмотреть наш расчет по доставке на склады Wildberries и Ozon? Какие даты ближайшей поставки сейчас рассматриваете? Готовы забронировать место в машине под ваш объем.`
  }

  return `Здравствуйте! Логистическая компания А2 Group.

Подскажите, пожалуйста, удалось ли ознакомиться с нашим расчетом ставок на перевозку в Россию? Какие направления и даты отгрузок сейчас наиболее актуальны? Готовы зафиксировать выгодную ставку под ваш рейс.`
}

export function isFollowUpNeeded(lead) {
  if (!lead) return { needed: false, daysAgo: 0 }

  const isQuoteStage = lead.stage === 'proposal_sent' || lead.stage === 'quote'
  const isQuoteOutcome = lead.last_outcome === 'quote'

  if (!isQuoteStage && !isQuoteOutcome) {
    return { needed: false, daysAgo: 0 }
  }

  // Проверяем дату изменения стадии или последнего звонка
  const timestampStr = lead.quote_sent_at || lead.stage_changed_at || lead.last_call_at || lead.updated_at
  if (!timestampStr) {
    return { needed: true, daysAgo: 1 }
  }

  const quoteTime = new Date(timestampStr).getTime()
  if (isNaN(quoteTime)) {
    return { needed: true, daysAgo: 1 }
  }

  const hoursDiff = (Date.now() - quoteTime) / (1000 * 60 * 60)
  // Если прошло больше 20 часов — пора дожимать
  if (hoursDiff >= 20) {
    const daysAgo = Math.max(1, Math.floor(hoursDiff / 24))
    return { needed: true, daysAgo }
  }

  return { needed: false, daysAgo: 0 }
}

export function cleanPhoneIntl(rawPhone) {
  if (!rawPhone) return ''
  const digits = String(rawPhone).replace(/\D/g, '')
  if (digits.startsWith('80') && digits.length === 11) {
    return '375' + digits.slice(2)
  }
  return digits
}

export function getQrCodeUrl(phone) {
  const intl = cleanPhoneIntl(phone)
  if (!intl) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('tel:+' + intl)}&margin=4`
}

export function getWhatsAppKpUrl(phone, proposalText) {
  const intl = cleanPhoneIntl(phone)
  if (!intl) return ''
  return `https://wa.me/${intl}?text=${encodeURIComponent(proposalText)}`
}

export function getTelegramKpUrl(phone) {
  const intl = cleanPhoneIntl(phone)
  if (!intl) return ''
  return `https://t.me/+${intl}`
}

export function getTelegramCustomUrl(target) {
  if (!target) return ''
  const t = target.trim()
  if (t.startsWith('@')) {
    return `https://t.me/${t.slice(1)}`
  }
  if (t.startsWith('http')) {
    return t
  }
  const intl = cleanPhoneIntl(t)
  if (intl) {
    return `https://t.me/+${intl}`
  }
  return `https://t.me/${t}`
}

export function getEmailKpUrl(email, lead, proposalText) {
  if (!email) return ''
  const cName = lead?.company || lead?.name || 'вашей компании'
  const subject = `Коммерческое предложение по автоперевозкам А2 Group — ${cName}`
  return `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(proposalText)}`
}
