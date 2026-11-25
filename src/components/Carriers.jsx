import { useState, useEffect } from 'react'
import { getCarriers, getCarrierRouteActivity, deleteCarrier as apiDelete } from '../api'
import { fmtDate, getGradient } from '../utils'
import { SkeletonList } from './Skeleton'
import { iosError } from './IOSAlert'
import Select from './Select'

const ROUTES = [
  ['', 'Все города'], ['moscow', 'Москва и МО'], ['spb', 'Санкт-Петербург'],
  ['ulyanovsk', 'Ульяновск'], ['smolensk', 'Смоленск'], ['belarus', 'По Беларуси'],
  ['other_ru', 'Другие города РФ'],
]
const SELECTS = [
  ['direction', [
    ['', 'Любое плечо'], ['by_to_ru', 'РБ → РФ'], ['ru_to_by', 'РФ → РБ'],
    ['within_by', 'Внутри РБ'], ['within_ru', 'Внутри РФ'],
  ]],
  ['days', [['', 'За всё время'], ['30', 'За 30 дней'], ['90', 'За 90 дней'], ['180', 'За 180 дней']]],
  ['body', [
    ['', 'Любой кузов'], ['curtain', 'Тент / штора'], ['refrigerated', 'Рефрижератор'],
    ['insulated', 'Изотерм'], ['van', 'Фургон'], ['flatbed', 'Борт'],
    ['container', 'Контейнер'], ['lowbed', 'Трал'],
  ]],
  ['sort', [['', 'Обычный порядок'], ['count', 'Больше рейсов'], ['latest', 'Ездили недавно']]],
]
const EMPTY_FILTERS = { area: '', direction: '', days: '', body: '', phone: false, sort: '' }
const FILTERS_KEY = 'crm_carrier_filters'
const TRIP_WORDS = { one: 'рейс', few: 'рейса', many: 'рейсов', other: 'рейса' }
const TRIP_PLURALS = new Intl.PluralRules('ru')

function readFilters() {
  try {
    return { ...EMPTY_FILTERS, ...JSON.parse(sessionStorage.getItem(FILTERS_KEY) || '{}') }
  } catch {
    return EMPTY_FILTERS
  }
}

function firstTripDate(today, days) {
  if (!today || !days) return ''
  const date = new Date(today + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() - Number(days) + 1)
  return date.toISOString().slice(0, 10)
}

function tripSummary(history, { area, direction, body }, firstDate, today) {
  const cardBody = history?.card_body
  const trips = history?.trips || []
  let count = 0
  let latest = ''
  let bodyFromOrder = false
  for (const trip of trips) {
    if (area && !trip.areas.includes(area)) continue
    if (direction && trip.direction !== direction) continue
    if (firstDate && (!trip.date || trip.date < firstDate || trip.date > today)) continue
    if (body && (trip.body || cardBody) !== body) continue
    count += 1
    if (trip.date && trip.date > latest) latest = trip.date
    if (body && trip.body === body) bodyFromOrder = true
  }
  const cardOnly = Boolean(body && body === cardBody && !trips.length && !area && !direction && !firstDate)
  return { count, latest, cardOnly, bodyFromCard: cardOnly || Boolean(body && count && !bodyFromOrder) }
}

// Same cleanup as Clients.jsx — imported phone fields sometimes carry
// several numbers (and stray fragments) jammed into one comma-separated
// string; show the first one that actually looks like a phone number.
function primaryPhone(raw) {
  if (!raw) return ''
  const parts = String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean)
  return parts.find(p => (p.match(/\d/g) || []).length >= 6) || parts[0] || ''
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--fg-d97706)" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export default function Carriers({ onOpenCarrier, onAdd, refreshKey, search = '' }) {
  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState(false)
  const [historyRetry, setHistoryRetry] = useState(0)
  const [filters, setFilters] = useState(readFilters)

  useEffect(() => {
    setLoading(true)
    getCarriers()
      .then(r => setCarriers(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  useEffect(() => {
    let active = true
    getCarrierRouteActivity()
      .then(data => { if (active) setHistory(data) })
      .catch(() => { if (active) setHistoryError(true) })
    return () => { active = false }
  }, [refreshKey, historyRetry])

  function updateFilters(next) {
    setFilters(next)
    try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try { await apiDelete(id) } catch (err) { console.error(err); iosError('Перевозчик не удалён. Проверьте интернет и попробуйте ещё раз.'); return }
    setCarriers(prev => prev.filter(c => c.id !== id))
  }

  let candidates = carriers
  if (search) {
    const q = search.toLowerCase()
    candidates = carriers.filter(c =>
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.driver_name && c.driver_name.toLowerCase().includes(q)) ||
      (c.plate && c.plate.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(search)) ||
      (c.inn && c.inn.includes(search))
    )
  }

  const { area, direction, days, body, phone: phoneOnly, sort } = filters
  const filtersByTrip = Boolean(area || direction || days || body)
  const usesHistory = filtersByTrip || Boolean(sort)
  const hasFilters = usesHistory || phoneOnly
  const firstDate = firstTripDate(history?.today, days)
  const visible = []
  if (!usesHistory || history) {
    for (const carrier of candidates) {
      const phone = primaryPhone(carrier.phone)
      if (phoneOnly && (phone.match(/\d/g) || []).length < 6) continue
      const summary = usesHistory ? tripSummary(history.carriers[carrier.id], filters, firstDate, history.today) : null
      if (filtersByTrip && !summary.count && !summary.cardOnly) continue
      visible.push({ carrier, phone, summary })
    }
  }
  if (usesHistory && history) {
    visible.sort((a, b) => {
      const count = b.summary.count - a.summary.count
      const recent = b.summary.latest.localeCompare(a.summary.latest)
      return sort === 'latest' ? recent || count : count || recent
    })
  }
  const waitingForHistory = usesHistory && !history && !historyError
  const pending = loading || waitingForHistory

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card carrier-filters">
        <div className="carrier-filter-header">
          <div className="carrier-result" aria-live="polite">
            {pending ? 'Загрузка списка…' : usesHistory && !history ? 'Перевозчики' : hasFilters || search
              ? <>Найдено <strong>{visible.length}</strong> из {carriers.length}</>
              : <>Всего перевозчиков <strong>{carriers.length}</strong></>}
          </div>
          <button type="button" className="btn-primary carrier-add" aria-label="Добавить перевозчика" onClick={onAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Добавить<span className="carrier-add-object"> перевозчика</span></span>
          </button>
        </div>
        <div className="carrier-route-group" role="group" aria-labelledby="carrier-route-label">
          <div className="carrier-filter-header">
            <span id="carrier-route-label" className="carrier-route-label">Направления</span>
            {hasFilters && <button type="button" className="carrier-filter-reset" onClick={() => updateFilters(EMPTY_FILTERS)}>Сбросить</button>}
          </div>
          <div className="carrier-route-choices">
            {ROUTES.map(([value, label]) => (
              <button key={value} type="button" className="carrier-control carrier-route"
                aria-pressed={area === value} onClick={() => updateFilters({ ...filters, area: value })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="carrier-criteria" role="group" aria-label="Фильтры перевозчиков">
          {SELECTS.map(([key, options]) => (
            <Select key={key} fit className={`carrier-control carrier-select${filters[key] ? ' is-on' : ''}`} value={filters[key]}
              onChange={e => updateFilters({ ...filters, [key]: e.target.value })}>
              {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          ))}
          <button type="button" className="carrier-control carrier-phone"
            aria-pressed={phoneOnly} onClick={() => updateFilters({ ...filters, phone: !phoneOnly })}>
            С телефоном
          </button>
        </div>
        {body && <p className="carrier-filter-note">Кузов из заявки или из карточки, если в заявке он не указан.</p>}
        {historyError && (
          <div className="carrier-history-status" role="status">
            История рейсов не загрузилась.
            <button type="button" className="btn-ghost" onClick={() => { setHistoryError(false); setHistoryRetry(n => n + 1) }}>Повторить</button>
          </div>
        )}
      </div>

      {pending && <SkeletonList />}
      {!pending && !(usesHistory && !history) && !visible.length && (
        <div className="card carrier-filter-empty">По выбранным условиям перевозчики не найдены.</div>
      )}
      {!pending && visible.length > 0 && (
      // iOS 26: список как в «Контактах» — одна группа-лист, строки с разделителями и › справа
      <div className="ios-list">
        {visible.map(({ carrier, phone, summary }) => {
          const name = carrier.company_name || carrier.name || '—'
          const driver = carrier.driver_name || carrier.driver || ''
          const cap = carrier.capacity_tons ? carrier.capacity_tons + ' т' : (carrier.cap || '')
          const vehicleType = carrier.vehicle_type || ''
          const [avA, avB] = getGradient(name)
          const sub = [driver, cap, vehicleType, carrier.plate, carrier.regions].filter(Boolean).join(' · ')
          return (
            <div key={carrier.id} className="ios-row" onClick={() => onOpenCarrier(carrier.id)}>
              <div className="ios-row-avatar" style={{ '--av-hue': avB, background: `linear-gradient(160deg, ${avA} 0%, ${avB} 100%)` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
              <div className="ios-row-text">
                <div className="ios-row-title">{name}</div>
                <div className="ios-row-sub">{sub || phone || 'Нет данных'}</div>
                {summary && (summary.count > 0 || summary.cardOnly) && (
                  <div className="carrier-trip-summary">
                    {summary.count > 0 && <>
                      <span>{summary.count} {TRIP_WORDS[TRIP_PLURALS.select(summary.count)]}</span>
                      <span>{summary.latest ? `Последний ${fmtDate(summary.latest)}` : 'Дата не указана'}</span>
                    </>}
                    {summary.bodyFromCard && <span>Кузов из карточки</span>}
                  </div>
                )}
              </div>
              <span className="ios-row-badge"><StarIcon />{carrier.rating || '5.0'}</span>
                <div className="ios-row-actions" onClick={e => e.stopPropagation()}>
                  {phone && (
                    <a href={`tel:${phone}`} className="ios-row-icon ios-row-icon--blue" title="Позвонить" onClick={e => e.stopPropagation()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </a>
                  )}
                  <button onClick={e => handleDelete(e, carrier.id)} className="ios-row-icon ios-row-icon--red ios-row-del" title="Удалить">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
                <svg className="ios-row-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 1.5 6.5 6.5 1.5 11.5"/></svg>
            </div>
          )
        })}
      </div>

      )}
    </div>
  )
}
