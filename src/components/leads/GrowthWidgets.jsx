import { useEffect, useState } from 'react'
import { completeLeadReactivation, getLeadPaidConversion, getLeadPriorities, getLeadReactivation, saveLeadQualification } from '../../api'
import { Loader } from '../Loader'
import LeadDisclosure from './LeadDisclosure'
import { leadLegalName } from '../../utils'
import './lead-growth.css'

const tracks = { marketplace: 'WB / Ozon', lookalike: 'Аналоги клиентов' }
const signalLabels = {
  quote_request: 'Запрос ставки',
  warehouse_supply: 'Поставки на склад',
  warehouse_opening: 'Новый склад',
  regular_route: 'Регулярный маршрут',
  new_channel: 'Новый канал продаж',
  hiring: 'Вакансия',
}
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const fmt = value => number.format(value)
const money = value => `${fmt(value)} BYN`
const formatDay = date => date ? date.slice(0, 10).split('-').reverse().join('.') : ''
const tel = phone => phone ? `tel:${phone.startsWith('+') ? '+' : ''}${phone.replace(/\D/g, '')}` : null

function LoadError({ text, retry }) {
  return <div className="lead-growth-state" role="alert">
    <span>{text}</span><button type="button" onClick={retry} className="btn-ghost">Повторить</button>
  </div>
}

export function DailyPriorities({ industry, revision, isAvailable, onOpen, disabled, activeId }) {
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let ignore = false
    setResult(null)
    setFailed(false)
    getLeadPriorities(industry).then(response => {
      if (!ignore) setResult(response.leads)
    }).catch(() => {
      if (!ignore) setFailed(true)
    })
    return () => { ignore = true }
  }, [industry, revision, attempt])

  const leads = (result || []).filter(isAvailable)
  const displayed = expanded ? leads : leads.slice(0, 3)
  return <section className="card lead-growth-card" aria-labelledby="lead-priorities-title">
    <header className="lead-growth-heading">
      <h2 id="lead-priorities-title">Кому звонить сегодня</h2>
      {leads.length > 0 && <span>{leads.length} в приоритете</span>}
    </header>
    {failed ? <LoadError text="Не удалось загрузить приоритеты." retry={() => setAttempt(n => n + 1)} />
      : !result ? <Loader padding={18} state="searching" label="Загрузка приоритетов…" />
        : !leads.length ? <p className="lead-growth-muted">Новых приоритетных звонков нет.</p>
          : <><ul className="lead-growth-list" id="lead-priority-results">
            {displayed.map(lead => {
              const legalName = leadLegalName(lead)
              return (
                <li key={lead.id} className="lead-growth-row">
                  <div className="lead-growth-row-copy">
                    <div className="lead-growth-row-title">
                      <strong>{legalName || lead.company || lead.name}</strong>
                      <span className="lead-growth-tag">{tracks[lead.codex_track]}</span>
                      {signalLabels[lead.signal_type] && <span className="lead-growth-tag lead-growth-tag--accent">{signalLabels[lead.signal_type]}</span>}
                    </div>
                    <p>{[!legalName && 'Юрназвание уточнить', lead.city, lead.phone || lead.email, lead.signal_text || lead.selection_reason].filter(Boolean).join(' · ')}</p>
                  </div>
                  <button type="button" className="btn-ghost" disabled={disabled || activeId === lead.id}
                    onClick={() => onOpen(lead)}>{activeId === lead.id ? 'Открыт' : 'Открыть'}</button>
                </li>
              )
            })}
          </ul>{leads.length > 3 && <button type="button" className="btn-ghost lead-growth-more"
            aria-controls="lead-priority-results" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? 'Свернуть список' : `Показать все ${leads.length}`}
          </button>}</>}
  </section>
}

const fieldDefinitions = {
  platform: ['Площадка', 'WB / Ozon'],
  scheme: ['Схема поставки', 'FBO / FBW / FBS'],
  warehouse: ['Склад или СЦ', 'Например, Коледино'],
  packaging: ['Упаковка', 'Паллеты / коробки'],
  pickup_city: ['Город погрузки', 'Москва'],
  delivery_city: ['Город выгрузки', 'Минск'],
  cargo: ['Груз', 'Вид товара'],
  volume: ['Объём партии', '3 паллеты, 600 кг'],
  frequency: ['Частота', '4 раза в месяц'],
  next_shipment: ['Ближайшая отгрузка', '', 'date'],
  payment_terms: ['Условия оплаты', '10 рабочих дней'],
  decision_maker: ['Кто выбирает перевозчика', 'Имя или должность'],
}

export function LeadQualification({ lead }) {
  const [form, setForm] = useState(() => lead.qualification || {})
  const [baseline, setBaseline] = useState(() => lead.qualification || {})
  const [status, setStatus] = useState('')
  const market = lead.codex_track === 'marketplace' || lead.funnel === 'WB_OZON'
  const fields = market
    ? ['platform', 'scheme', 'pickup_city', 'warehouse', 'packaging', 'volume', 'frequency', 'next_shipment', 'decision_maker']
    : ['pickup_city', 'delivery_city', 'cargo', 'volume', 'frequency', 'next_shipment', 'payment_terms', 'decision_maker']

  const change = (key, value) => {
    setForm(prior => ({ ...prior, [key]: value }))
    setStatus('')
  }
  const save = async event => {
    event.preventDefault()
    if (status === 'busy') return
    setStatus('busy')
    try {
      const edited = Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== baseline[key]))
      if ('next_shipment' in edited) edited.next_shipment ||= null
      const response = await saveLeadQualification(lead.id, edited)
      setForm(response.qualification)
      setBaseline(response.qualification)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <LeadDisclosure title="Уточнить у клиента" className="lead-qualification">
      <form onSubmit={save}>
        <fieldset disabled={status === 'busy'}>
          <div className="lead-qualification-fields">
            {fields.map(key => {
              const [label, placeholder, type] = fieldDefinitions[key]
              return <label className="form-field" key={key}>
                <span className="form-label">{label}</span>
                <input className="form-input" type={type || 'text'} value={form[key] ?? ''} placeholder={placeholder}
                  maxLength={type ? undefined : key === 'cargo' ? 240 : ['platform', 'scheme'].includes(key) ? 32 : 120}
                  onChange={event => change(key, event.target.value)} />
              </label>
            })}
          </div>
          <div className="lead-growth-actions">
            <label className="lead-qualification-check"><input type="checkbox" checked={Boolean(form.quote_requested)}
              onChange={event => change('quote_requested', event.target.checked)} /> Клиент запросил ставку</label>
            <button type="submit" className="btn-primary">{status === 'busy' ? 'Сохраняю…' : 'Сохранить'}</button>
            {status === 'saved' && <span role="status">Сохранено</span>}
            {status === 'error' && <span role="alert">Сохранить не удалось. Попробуйте ещё раз.</span>}
          </div>
        </fieldset>
      </form>
    </LeadDisclosure>
  )
}

export function ReactivationView() {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState('')
  const [actionError, setActionError] = useState(false)
  const reload = () => setAttempt(n => n + 1)

  useEffect(() => {
    let ignore = false
    setFailed(false)
    getLeadReactivation().then(value => {
      if (!ignore) setData(value)
    }).catch(() => {
      if (!ignore) setFailed(true)
    })
    return () => { ignore = true }
  }, [attempt])

  const finish = async taskId => {
    setPending(taskId)
    setActionError(false)
    try {
      await completeLeadReactivation(taskId)
      setData(value => ({ ...value, clients: value.clients.filter(client => client.task_id !== taskId) }))
      reload()
    } catch {
      setActionError(true)
    } finally {
      setPending('')
    }
  }

  return <section className="card lead-growth-card">
    <header className="lead-growth-heading"><h2>Кого вернуть в работу</h2>
      {data?.week && <span>Неделя с {formatDay(data.week)}</span>}
    </header>
    {actionError && <p role="alert" className="lead-growth-muted">Звонок не отмечен. Попробуйте ещё раз.</p>}
    {failed ? <LoadError text="Не удалось загрузить список клиентов." retry={reload} />
      : !data ? <Loader padding={22} state="searching" label="Загрузка клиентов…" />
        : !data.clients.length ? <p className="lead-growth-muted">На этой неделе нет клиентов для возврата.</p>
          : <ul className="lead-growth-list">
            {data.clients.map(client => <li key={client.task_id} className="lead-growth-row lead-reactivation-row">
              <div className="lead-growth-row-copy">
                <div className="lead-growth-row-title"><strong>{client.company}</strong><span className="lead-growth-tag">{client.days_idle} дн. без рейса</span></div>
                <p>{[client.last_route, formatDay(client.last_day), client.contact_person].filter(Boolean).join(' · ')}</p>
                {client.last_order_id && <a className="lead-growth-order" href={`/?order=${encodeURIComponent(client.last_order_id)}`}>
                  {client.last_order_number || 'Последняя заявка'}
                </a>}
                <p className="lead-reactivation-question">{client.question}</p>
              </div>
              <div className="lead-reactivation-actions">
                <div><strong>{money(client.margin_year)}</strong><small>маржа за 12 месяцев</small></div>
                {client.phone && <a href={tel(client.phone)} className="btn-ghost">Позвонить</a>}
                <button type="button" className="btn-ghost" disabled={Boolean(pending)} onClick={() => finish(client.task_id)}>
                  {pending === client.task_id ? 'Сохраняю…' : 'Отметить звонок'}
                </button>
              </div>
            </li>)}
          </ul>}
  </section>
}

export function PaidConversion({ period }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    setFailed(false)
    setData(null)
    getLeadPaidConversion(period).then(value => {
      if (!ignore) setData(value)
    }).catch(() => {
      if (!ignore) setFailed(true)
    })
    return () => { ignore = true }
  }, [period, attempt])

  return <section className="card lead-growth-card" aria-labelledby="lead-conversion-title">
    <header className="lead-growth-heading"><h2 id="lead-conversion-title">От лида до оплаченного рейса</h2>
      {data && <span>{formatDay(data.start)} — {formatDay(data.through)}</span>}
    </header>
    {failed ? <LoadError text="Не удалось загрузить отчёт." retry={() => setAttempt(n => n + 1)} />
      : !data ? <Loader padding={22} state="searching" label="Загрузка отчёта…" />
        : <>
          <div className="lead-growth-table" tabIndex={0}>
            <table>
              <thead><tr>{['Группа', 'Новые лиды', 'Запросили ставку', 'Первый оплаченный', 'Повторный оплаченный', 'Маржа, BYN', 'Оплата после выгрузки'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
              <tbody>{data.tracks.map(row => <tr key={row.track}>
                <th scope="row">{tracks[row.track]}</th>
                <td>{fmt(row.leads)}</td><td>{fmt(row.quote_requested)}</td><td>{fmt(row.first_paid)}</td>
                <td>{fmt(row.repeat_paid)}</td><td className="lead-growth-margin">{fmt(row.margin)}</td>
                <td>{row.payment_days == null ? '—' : <>{fmt(row.payment_days)} дн.<small>По {row.payment_dates} из {row.paid_orders} рейсов</small></>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="lead-growth-muted">Группы по дате добавления лида. Отчёт связывает рейсы с карточкой клиента, созданной из лида. Срок оплаты — медиана по завершённым рейсам с датой платежа.</p>
        </>}
  </section>
}
