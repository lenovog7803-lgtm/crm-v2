import { useState, useEffect } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createOrder, updateOrder, getClients, getCarriers, getToken, syncToSheets, getOrders } from '../api'
import { mouseOnly } from '../motion'
import { iosConfirm } from './IOSAlert'
import DateInput from './DateInput'

const POPULAR_CITIES = [
  'Минск', 'Брест', 'Гродно', 'Гомель', 'Могилёв', 'Витебск', 'Бобруйск',
  'Барановичи', 'Борисов', 'Пинск', 'Орша', 'Мозырь', 'Солигорск',
  'Новополоцк', 'Молодечно', 'Лида', 'Слуцк', 'Жодино', 'Жлобин',
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Пермь', 'Воронеж', 'Волгоград', 'Краснодар',
  'Саратов', 'Тюмень', 'Тольятти', 'Ижевск', 'Барнаул', 'Ярославль',
  'Иркутск', 'Хабаровск', 'Владивосток', 'Махачкала', 'Томск', 'Оренбург',
  'Кемерово', 'Новокузнецк', 'Рязань', 'Астрахань', 'Набережные Челны',
  'Пенза', 'Липецк', 'Тула', 'Киров', 'Чебоксары', 'Калининград',
  'Брянск', 'Курск', 'Иваново', 'Магнитогорск', 'Тверь', 'Ставрополь',
  'Белгород', 'Сочи', 'Смоленск', 'Владимир', 'Вологда', 'Подольск',
]

const iStyle = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 10,
  border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)',
  fontFamily: 'var(--font-sys)', fontSize: 13, color: '#0E1726', outline: 'none', boxSizing: 'border-box',
}

const labelSt = {
  fontSize: 13, fontWeight: 500, color: '#6B7480',
  marginBottom: 6, paddingLeft: 4, display: 'block',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <label style={labelSt}>{label}</label>
      {children}
    </div>
  )
}

function Grid2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>{children}</div>
}

// Порог «пустой» заявки — как во вкладке «План»: маржа меньше 150 Br или меньше 15% от ставки клиента
const MIN_MARGIN = 150, MIN_PCT = 0.15
const cityKey = s => String(s || '').split(',')[0].trim().toLowerCase().replace(/ё/g, 'е')
const orderDay = o => String(o.load_date || o.unload_date || o.created_at || '').slice(0, 10)

// Как обычно идёт это направление: по заявкам за 3 месяца (мало — за всё время)
function routeStats(orders, from, to, excludeId) {
  const f = cityKey(from), t = cityKey(to)
  if (!f || !t) return null
  const same = orders.filter(o => o.id !== excludeId && o.status !== 'cancelled' && +o.client_rate > 0
    && cityKey(o.route_from) === f && cityKey(o.route_to) === t)
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)
  const recent = same.filter(o => orderDay(o) >= since)
  const use = recent.length >= 3 ? recent : same
  if (use.length < 2) return null
  const avg = k => use.reduce((s, o) => s + (+o[k] || 0), 0) / use.length
  return { n: use.length, recent: use === recent, client: avg('client_rate'), carrier: avg('carrier_rate'), margin: avg('client_rate') - avg('carrier_rate') }
}

function SectionTitle({ title }) {
  return (
    <div style={{ fontSize: 16, fontWeight: 700, color: '#0E1726', letterSpacing: '-0.01em' }}>
      {title}
    </div>
  )
}

function ComboSelect({ value, onTextChange, onSelect, items, placeholder, labelFn }) {
  const [show, setShow] = useState(false)
  const matches = value.length >= 1
    ? items.filter(i => labelFn(i).toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : items.slice(0, 8)

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onTextChange(e.target.value); setShow(true) }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder={placeholder}
        style={iStyle}
      />
      {show && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(20px)',
          borderRadius: 12, border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 16px 40px rgba(20,30,55,0.15)', overflow: 'hidden', marginTop: 4,
        }}>
          {matches.map(item => (
            <div
              key={item.id}
              onMouseDown={() => { onSelect(item); setShow(false) }}
              style={{ padding: '10px 14px', fontSize: 13, color: '#0E1726', cursor: 'pointer', borderBottom: '1px solid rgba(14,23,38,0.05)', transition: 'background 0.1s' }}
              onPointerEnter={mouseOnly(e => e.currentTarget.style.background = 'rgba(19,102,240,0.07)')}
              onPointerLeave={mouseOnly(e => e.currentTarget.style.background = 'transparent')}
            >
              {labelFn(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CityInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [show, setShow] = useState(false)

  const handleChange = v => {
    onChange(v)
    if (v.length >= 2) {
      const filtered = POPULAR_CITIES.filter(c => c.toLowerCase().startsWith(v.toLowerCase())).slice(0, 6)
      setSuggestions(filtered)
      setShow(true)
    } else {
      setShow(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        style={iStyle}
      />
      {show && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
          borderRadius: 12, border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 16px 40px rgba(20,30,55,0.15)', overflow: 'hidden', marginTop: 4,
        }}>
          {suggestions.map(city => (
            <div
              key={city}
              onMouseDown={() => { onChange(city); setShow(false) }}
              style={{ padding: '10px 14px', fontSize: 13, color: '#0E1726', cursor: 'pointer', borderBottom: '1px solid rgba(14,23,38,0.05)', transition: 'background 0.1s' }}
              onPointerEnter={mouseOnly(e => e.currentTarget.style.background = 'rgba(19,102,240,0.07)')}
              onPointerLeave={mouseOnly(e => e.currentTarget.style.background = 'transparent')}
            >
              {city}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CreateOrderModal({ onClose, onSuccess, initialData, editOrderId }) {
  const isEdit = Boolean(editOrderId)
  const [isDirty, setIsDirty] = useState(false)
  const handleClose = async () => {
    if (isDirty && !(await iosConfirm('Вы уверены? Изменения не сохранятся.'))) return
    onClose()
  }
  const [clients, setClients] = useState([])
  const [carriers, setCarriers] = useState([])
  const [pastOrders, setPastOrders] = useState([])  // для подсказки «как обычно идёт это направление»
  useEffect(() => {
    getOrders({ limit: 5000, light: true }).then(r => setPastOrders(Array.isArray(r) ? r : (r?.orders || r?.data || []))).catch(() => {})
  }, [])
  const [form, setForm] = useState({
    client_id: initialData?.client_id || '',
    client_name: initialData?.client_name || '',
    carrier_id: initialData?.carrier_id || '',
    carrier_name: initialData?.carrier_name || '',
    route_from: initialData?.route_from || '',
    route_to: initialData?.route_to || '',
    route_from_address: initialData?.route_from_address || '',
    route_to_address: initialData?.route_to_address || '',
    load_date: isEdit ? (initialData?.load_date || '') : '',
    unload_date: isEdit ? (initialData?.unload_date || '') : '',
    client_rate: initialData?.client_rate ? String(initialData.client_rate) : '',
    carrier_rate: initialData?.carrier_rate ? String(initialData.carrier_rate) : '',
    payment_days: initialData?.payment_days ? String(initialData.payment_days) : '20',
    vehicle_info: initialData?.vehicle_info || '',
    cargo: initialData?.cargo || '',
    weight_tons: initialData?.weight_tons ? String(initialData.weight_tons) : '',
    notes: initialData?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getClients().then(r => setClients(Array.isArray(r) ? r : [])).catch(() => {})
    getCarriers().then(r => setCarriers(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const upd = (k, v) => { setIsDirty(true); setForm(p => ({ ...p, [k]: v })) }

  const handleCarrierSelect = carrier => {
    const vehicleInfo = [carrier.plate, carrier.vehicle_type, carrier.driver_name, carrier.phone].filter(Boolean).join(', ')
    setForm(p => ({
      ...p,
      carrier_id: carrier.id,
      carrier_name: carrier.company_name || carrier.name || '',
      vehicle_info: vehicleInfo || p.vehicle_info,
    }))
  }

  const handleClientSelect = client => {
    setForm(p => ({ ...p, client_id: client.id, client_name: client.name || '' }))
  }

  const margin = form.client_rate && form.carrier_rate
    ? Number(form.client_rate) - Number(form.carrier_rate)
    : null
  const marginPct = margin !== null && Number(form.client_rate) > 0
    ? ((margin / Number(form.client_rate)) * 100).toFixed(1)
    : null

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.route_from || !form.route_to) { setError('Заполните откуда и куда'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        route_from: form.route_from,
        route_to: form.route_to,
        route_from_address: form.route_from_address || undefined,
        route_to_address: form.route_to_address || undefined,
        client_id: form.client_id || undefined,
        client_name: form.client_name || undefined,
        carrier_id: form.carrier_id || undefined,
        carrier_name: form.carrier_name || undefined,
        client_rate: form.client_rate ? Number(form.client_rate) : 0,
        carrier_rate: form.carrier_rate ? Number(form.carrier_rate) : 0,
        payment_days: form.payment_days ? Number(form.payment_days) : 20,
        vehicle_info: form.vehicle_info || undefined,
        cargo: form.cargo || undefined,
        weight_tons: form.weight_tons ? Number(form.weight_tons) : undefined,
        load_date: form.load_date || undefined,
        unload_date: form.unload_date || undefined,
        notes: form.notes || undefined,
      }
      if (isEdit) {
        await updateOrder(editOrderId, payload)
      } else {
        await createOrder({ ...payload, status: 'new' })
      }
      syncToSheets().catch(() => {})
      setIsDirty(false)
      onSuccess()
    } catch (e) {
      setError(isEdit ? 'Ошибка при сохранении' : 'Ошибка при создании заявки')
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={handleClose}>
      <ModalHeader title={isEdit ? 'Редактировать заявку' : 'Новая заявка'} onClose={handleClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 1. Стороны */}
        <div className="ios-form-group">
          <SectionTitle title="Стороны" />
          <Grid2>
            <Field label="Клиент">
              <ComboSelect
                value={form.client_name}
                onTextChange={v => upd('client_name', v)}
                onSelect={handleClientSelect}
                items={clients}
                placeholder="Введите или выберите клиента..."
                labelFn={c => c.name || ''}
              />
            </Field>
            <Field label="Перевозчик">
              <ComboSelect
                value={form.carrier_name}
                onTextChange={v => upd('carrier_name', v)}
                onSelect={handleCarrierSelect}
                items={carriers}
                placeholder="Введите или выберите перевозчика..."
                labelFn={c => c.company_name || c.name || ''}
              />
            </Field>
          </Grid2>
        </div>

        {/* 2. Маршрут */}
        <div className="ios-form-group">
          <SectionTitle title="Маршрут" />
          <Grid2>
            <Field label="Откуда">
              <CityInput value={form.route_from} onChange={v => upd('route_from', v)} placeholder="Город отправления" />
            </Field>
            <Field label="Куда">
              <CityInput value={form.route_to} onChange={v => upd('route_to', v)} placeholder="Город назначения" />
            </Field>
          </Grid2>
          <Grid2>
            <Field label="Адрес загрузки">
              <input value={form.route_from_address} onChange={e => upd('route_from_address', e.target.value)}
                placeholder="Улица, дом, склад, контакт..." style={iStyle} />
            </Field>
            <Field label="Адрес выгрузки">
              <input value={form.route_to_address} onChange={e => upd('route_to_address', e.target.value)}
                placeholder="Улица, дом, склад, контакт..." style={iStyle} />
            </Field>
          </Grid2>
        </div>

        {/* 3. Даты */}
        <div className="ios-form-group">
          <SectionTitle title="Даты" />
          <Grid2>
            <Field label="Загрузка">
              <DateInput type="date" value={form.load_date} onChange={e => upd('load_date', e.target.value)} style={iStyle} />
            </Field>
            <Field label="Выгрузка">
              <DateInput type="date" value={form.unload_date} onChange={e => upd('unload_date', e.target.value)} style={iStyle} />
            </Field>
          </Grid2>
        </div>

        {/* 4. Финансы */}
        <div className="ios-form-group">
          <SectionTitle title="Финансы" />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <Field label="Клиент платит, Br">
              <input type="number" value={form.client_rate} onChange={e => upd('client_rate', e.target.value)}
                placeholder="0" style={iStyle} />
            </Field>
            <Field label="Перевозчику, Br">
              <input type="number" value={form.carrier_rate} onChange={e => upd('carrier_rate', e.target.value)}
                placeholder="0" style={iStyle} />
            </Field>
            <Field label="Отсрочка, дней">
              <input type="number" value={form.payment_days} onChange={e => upd('payment_days', e.target.value)}
                placeholder="20" style={iStyle} />
            </Field>
          </div>
          <MarginHint margin={margin} marginPct={marginPct} client={Number(form.client_rate) || 0} carrier={Number(form.carrier_rate) || 0}
            route={routeStats(pastOrders, form.route_from, form.route_to, initialData?.id)} from={form.route_from} to={form.route_to} />
        </div>

        {/* 5. ТС и водитель */}
        <div className="ios-form-group">
          <SectionTitle title="ТС и водитель" />
          <Field label="Номер, тип ТС, ФИО и телефон водителя">
            <input value={form.vehicle_info} onChange={e => upd('vehicle_info', e.target.value)}
              placeholder="А000АА77, Газель, Иванов Иван, +375291234567" style={iStyle} />
          </Field>
          <Grid2>
            <Field label="Груз">
              <input value={form.cargo} onChange={e => upd('cargo', e.target.value)}
                placeholder="Описание груза" style={iStyle} />
            </Field>
            <Field label="Вес, т">
              <input type="number" value={form.weight_tons} onChange={e => upd('weight_tons', e.target.value)}
                placeholder="0.0" style={iStyle} />
            </Field>
          </Grid2>
        </div>

        {/* 6. Примечания */}
        <div className="ios-form-group">
          <SectionTitle title="Примечания" />
          <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
            placeholder="Дополнительная информация..."
            style={{ ...iStyle, height: 72, padding: '10px 12px', resize: 'vertical' }} />
        </div>

        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-ghost" onClick={handleClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? (isEdit ? 'Сохранение...' : 'Создание...') : (isEdit ? 'Сохранить изменения' : 'Создать заявку →')}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')

// Подсказка под ставками: маржа и её оценка (нормальная / пустая / в минус), какая ставка нужна до порога,
// и как обычно идёт это направление
function MarginHint({ margin, marginPct, client, carrier, route, from, to }) {
  const kind = margin === null ? null : margin < 0 ? 'bad' : (margin < MIN_MARGIN || (client > 0 && margin / client < MIN_PCT)) ? 'empty' : 'ok'
  const tone = { ok: ['rgba(19,102,240,0.08)', '#1366F0'], empty: ['rgba(217,119,6,0.1)', '#B45309'], bad: ['rgba(200,25,35,0.08)', '#C81923'] }
  // до порога: клиенту не меньше …, или перевозчику не больше …
  const needClient = Math.ceil(Math.max(carrier + MIN_MARGIN, carrier / (1 - MIN_PCT)))
  const maxCarrier = Math.floor(Math.min(client - MIN_MARGIN, client * (1 - MIN_PCT)))
  return (
    <>
      {kind && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: tone[kind][0], color: tone[kind][1], fontSize: 13, lineHeight: 1.45 }}>
          <div style={{ fontWeight: 600 }}>
            {kind === 'bad' ? 'В минус' : kind === 'empty' ? 'Пустая заявка' : 'Маржа нормальная'}: {margin.toLocaleString('ru-RU')} Br{marginPct !== null && ` (${marginPct}%)`}
          </div>
          {kind !== 'ok' && client > 0 && carrier > 0 && (
            <div style={{ fontSize: 12.5, opacity: 0.9 }}>
              Порог — {MIN_MARGIN} Br и {Math.round(MIN_PCT * 100)}%. Нужно: клиенту от {int(needClient)} Br{maxCarrier > 0 ? ` или перевозчику до ${int(maxCarrier)} Br` : ''}.
            </div>
          )}
          {route && margin !== null && margin < route.margin - 20 && (
            <div style={{ fontSize: 12.5, opacity: 0.9 }}>Ниже обычной по этому направлению (~{int(route.margin)} Br).</div>
          )}
        </div>
      )}
      {route && (
        <div style={{ fontSize: 12.5, color: '#5A6573', padding: '0 4px', lineHeight: 1.5 }}>
          <b style={{ color: '#0E1726', fontWeight: 600 }}>{from.split(',')[0]} → {to.split(',')[0]}</b>
          {route.recent ? ' за 3 месяца' : ' за всё время'}: {route.n} заявок · клиент платит обычно ~{int(route.client)} Br ·
          перевозчику ~{int(route.carrier)} Br · маржа ~{int(route.margin)} Br
        </div>
      )}
    </>
  )
}
