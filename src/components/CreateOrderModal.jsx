import { useState, useEffect } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createOrder, getClients, getCarriers, getToken, syncToSheets } from '../api'

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
  fontFamily: 'Manrope', fontSize: 13, color: '#0E1726', outline: 'none', boxSizing: 'border-box',
}

const labelSt = {
  fontSize: 11, fontWeight: 700, color: '#8A93A0',
  letterSpacing: '0.06em', marginBottom: 5, display: 'block',
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
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function SectionTitle({ title }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#A6AEB8', paddingBottom: 8, borderBottom: '1px solid rgba(14,23,38,0.07)' }}>
      {title}
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
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(19,102,240,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {city}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CreateOrderModal({ onClose, onSuccess }) {
  const [clients, setClients] = useState([])
  const [carriers, setCarriers] = useState([])
  const [form, setForm] = useState({
    client_id: '', client_name: '',
    carrier_id: '', carrier_name: '',
    route_from: '', route_to: '',
    loading_address: '', unloading_address: '',
    load_date: '', unload_date: '',
    client_rate: '', carrier_rate: '',
    payment_days: '20',
    vehicle_info: '',
    cargo: '', weight_tons: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getClients().then(r => setClients(Array.isArray(r) ? r : [])).catch(() => {})
    getCarriers().then(r => setCarriers(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCarrierChange = carrierId => {
    const carrier = carriers.find(c => c.id === carrierId)
    if (carrier) {
      const vehicleInfo = [carrier.plate, carrier.vehicle_type, carrier.driver_name, carrier.phone].filter(Boolean).join(', ')
      setForm(p => ({
        ...p,
        carrier_id: carrierId,
        carrier_name: carrier.company_name || carrier.name || '',
        vehicle_info: vehicleInfo || p.vehicle_info,
      }))
    } else {
      upd('carrier_id', carrierId)
    }
  }

  const handleClientChange = clientId => {
    const client = clients.find(c => c.id === clientId)
    setForm(p => ({
      ...p,
      client_id: clientId,
      client_name: client?.name || '',
    }))
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
      await createOrder({
        route_from: form.route_from,
        route_to: form.route_to,
        loading_address: form.loading_address || undefined,
        unloading_address: form.unloading_address || undefined,
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
        status: 'new',
      })
      // Fire-and-forget Sheets sync
      syncToSheets().catch(() => {})
      onSuccess()
    } catch (e) {
      setError('Ошибка при создании заявки')
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Новая заявка" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 1. Стороны */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="СТОРОНЫ" />
          <Grid2>
            <Field label="КЛИЕНТ">
              <select value={form.client_id} onChange={e => handleClientChange(e.target.value)} style={iStyle}>
                <option value="">Выбрать клиента...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="ПЕРЕВОЗЧИК">
              <select value={form.carrier_id} onChange={e => handleCarrierChange(e.target.value)} style={iStyle}>
                <option value="">Выбрать перевозчика...</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
              </select>
            </Field>
          </Grid2>
        </div>

        {/* 2. Маршрут */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="МАРШРУТ" />
          <Grid2>
            <Field label="ОТКУДА (ГОРОД)">
              <CityInput value={form.route_from} onChange={v => upd('route_from', v)} placeholder="Город отправления" />
            </Field>
            <Field label="КУДА (ГОРОД)">
              <CityInput value={form.route_to} onChange={v => upd('route_to', v)} placeholder="Город назначения" />
            </Field>
          </Grid2>
          <Grid2>
            <Field label="ТОЧНЫЙ АДРЕС ЗАГРУЗКИ">
              <input value={form.loading_address} onChange={e => upd('loading_address', e.target.value)}
                placeholder="Улица, дом, склад, контакт..." style={iStyle} />
            </Field>
            <Field label="ТОЧНЫЙ АДРЕС ВЫГРУЗКИ">
              <input value={form.unloading_address} onChange={e => upd('unloading_address', e.target.value)}
                placeholder="Улица, дом, склад, контакт..." style={iStyle} />
            </Field>
          </Grid2>
        </div>

        {/* 3. Даты */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="ДАТЫ" />
          <Grid2>
            <Field label="ДАТА ЗАГРУЗКИ">
              <input type="date" value={form.load_date} onChange={e => upd('load_date', e.target.value)} style={iStyle} />
            </Field>
            <Field label="ДАТА ВЫГРУЗКИ">
              <input type="date" value={form.unload_date} onChange={e => upd('unload_date', e.target.value)} style={iStyle} />
            </Field>
          </Grid2>
        </div>

        {/* 4. Финансы */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="ФИНАНСЫ" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="СТАВКА КЛИЕНТА (Br)">
              <input type="number" value={form.client_rate} onChange={e => upd('client_rate', e.target.value)}
                placeholder="0" style={iStyle} />
            </Field>
            <Field label="СТАВКА ПЕРЕВОЗЧИКА (Br)">
              <input type="number" value={form.carrier_rate} onChange={e => upd('carrier_rate', e.target.value)}
                placeholder="0" style={iStyle} />
            </Field>
            <Field label="СРОК ОПЛАТЫ (ДНЕЙ)">
              <input type="number" value={form.payment_days} onChange={e => upd('payment_days', e.target.value)}
                placeholder="20" style={iStyle} />
            </Field>
          </div>
          {margin !== null && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: margin >= 0 ? 'rgba(19,102,240,0.08)' : 'rgba(200,25,35,0.08)',
              fontSize: 13, fontWeight: 600,
              color: margin >= 0 ? '#1366F0' : '#C81923',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>Маржа: {margin.toLocaleString('ru-RU')} Br</span>
              {marginPct !== null && <span style={{ opacity: 0.7 }}>({marginPct}%)</span>}
            </div>
          )}
        </div>

        {/* 5. ТС и водитель */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="ТС И ВОДИТЕЛЬ" />
          <Field label="ГОС. НОМЕР, МАРКА, ФИО ВОДИТЕЛЯ, ТЕЛЕФОН">
            <input value={form.vehicle_info} onChange={e => upd('vehicle_info', e.target.value)}
              placeholder="А000АА77, Газель, Иванов Иван, +375291234567" style={iStyle} />
          </Field>
          <Grid2>
            <Field label="ГРУЗ">
              <input value={form.cargo} onChange={e => upd('cargo', e.target.value)}
                placeholder="Описание груза" style={iStyle} />
            </Field>
            <Field label="ВЕС (Т)">
              <input type="number" value={form.weight_tons} onChange={e => upd('weight_tons', e.target.value)}
                placeholder="0.0" style={iStyle} />
            </Field>
          </Grid2>
        </div>

        {/* 6. Примечания */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="ПРИМЕЧАНИЯ" />
          <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
            placeholder="Дополнительная информация..."
            style={{ ...iStyle, height: 72, padding: '10px 12px', resize: 'vertical' }} />
        </div>

        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Создание...' : 'Создать заявку →'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
