import { useState, useEffect } from 'react'
import { createFleetOrder, updateFleetOrder, getFleetClients, getFleetVehicles, getFleetDrivers } from '../../api'
import { useToast } from '../../components/Toast'
import { ModalOverlay, ModalHeader } from '../../components/Modal'
import { SwapText } from '../../components/Transitions'
import Select from '../../components/Select'

const iStyle = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 10,
  border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)',
  fontFamily: 'var(--font-sys)', fontSize: 13, color: '#0E1726', outline: 'none', boxSizing: 'border-box',
}
const labelSt = { fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5, display: 'block' }

export function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString('ru-RU')
}

const Field = ({ label, children }) => <div><label style={labelSt}>{label}</label>{children}</div>
const Grid2 = ({ children }) => <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>{children}</div>
const SectionTitle = ({ title }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#A6AEB8', paddingBottom: 8, borderBottom: '1px solid rgba(14,23,38,0.07)' }}>{title}</div>
)
const vehLabel = v => [v?.model, v?.plate || v?.plate_truck].filter(Boolean).join(', ')

const SECTIONS = [
  { title: 'МАРШРУТ', fields: [
    { key: 'city_from', label: 'ОТКУДА (ГОРОД)', placeholder: 'Город отправления' },
    { key: 'city_to', label: 'КУДА (ГОРОД)', placeholder: 'Город назначения' },
    { key: 'loading_address', label: 'ТОЧНЫЙ АДРЕС ЗАГРУЗКИ', placeholder: 'Улица, дом, склад, контакт…', full: true },
    { key: 'unloading_address', label: 'ТОЧНЫЙ АДРЕС ВЫГРУЗКИ', placeholder: 'Улица, дом, склад, контакт…', full: true },
  ] },
  { title: 'ДАТЫ', fields: [
    { key: 'load_date', label: 'ДАТА ЗАГРУЗКИ', type: 'date' },
    { key: 'unload_date', label: 'ДАТА ВЫГРУЗКИ', type: 'date' },
  ] },
  { title: 'ГРУЗ', fields: [
    { key: 'cargo_name', label: 'НАЗВАНИЕ ГРУЗА', placeholder: 'Описание груза', full: true },
    { key: 'weight_tons', label: 'ВЕС (Т)', type: 'number', placeholder: '0.0' },
    { key: 'pallets_count', label: 'КОЛ-ВО ПАЛЛЕТ', type: 'number', placeholder: '0' },
    { key: 'pallet_size', label: 'РАЗМЕРЫ ПАЛЛЕТ', placeholder: 'напр. 1.2×0.8' },
    { key: 'volume_m3', label: 'ОБЪЁМ (М³)', type: 'number', placeholder: '0.0' },
  ] },
  { title: 'ФИНАНСЫ', fields: [
    { key: 'rate', label: 'СТАВКА КЛИЕНТА (Br)', type: 'number', placeholder: '0' },
    { key: 'pay_deferral_days', label: 'СРОК ОПЛАТЫ (ДНЕЙ)', type: 'number', placeholder: '20' },
  ] },
]
const ALL = SECTIONS.flatMap(s => s.fields)
const NUM_KEYS = ALL.filter(f => f.type === 'number').map(f => f.key)

export function FleetOrderModal({ tripId, direction, order, trip, onClose, onSaved }) {
  const { show } = useToast()
  const editing = !!order
  const [form, setForm] = useState(() => {
    const base = {
      client_id: order?.client_id || '',
      vehicle_id: order?.vehicle_id ?? (editing ? '' : (trip?.vehicle_id || '')),
      driver_id: order?.driver_id ?? (editing ? '' : (trip?.driver_id || '')),
    }
    for (const f of ALL) base[f.key] = f.type === 'date' ? (order?.[f.key] || '').slice(0, 10) : (order?.[f.key] ?? '')
    return base
  })
  const [clients, setClients] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    getFleetClients().then(r => setClients(r.clients || [])).catch(() => {})
    getFleetVehicles().then(r => setVehicles(r.vehicles || [])).catch(() => {})
    getFleetDrivers().then(r => setDrivers(r.drivers || [])).catch(() => {})
  }, [])

  const veh = vehicles.find(v => v.id === form.vehicle_id)
  const drv = drivers.find(d => d.id === form.driver_id)
  const tcLine = [veh && vehLabel(veh), drv && drv.name, drv && (drv.phone_ru || drv.phone_by || drv.phone)].filter(Boolean).join(', ')

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const client = clients.find(c => c.id === form.client_id)
      const payload = { ...form, client_name: client?.name || (editing ? order.client_name : '') || '' }
      for (const k of NUM_KEYS) payload[k] = payload[k] === '' || payload[k] == null ? 0 : Number(payload[k])
      if (editing) await updateFleetOrder(order.id, payload)
      else await createFleetOrder(tripId, { ...payload, direction })
      onSaved()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
      setSaving(false)
    }
  }

  const dir = direction || order?.direction
  const renderInput = (f) => (
    <input type={f.type || 'text'} value={form[f.key]} placeholder={f.placeholder || ''}
      onChange={e => set(f.key, e.target.value)} style={iStyle} />
  )

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader
        title={editing ? 'Редактировать заявку' : 'Новая заявка'}
        onClose={onClose}
      />
      <div style={{ marginTop: -14, marginBottom: 20, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#1366F0' }}>
        {editing ? (order.order_number || '№ —') : '№ присвоится после создания'}
        {dir ? <span style={{ color: '#A6AEB8', fontFamily: 'var(--font-sys)', fontWeight: 500, marginLeft: 10 }}>{dir === 'forward' ? 'прямой' : 'обратка'}</span> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="КЛИЕНТ" />
          <Field label="КЛИЕНТ">
            <Select style={iStyle} value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">Выберите клиента…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle title="ТС И ВОДИТЕЛЬ" />
          <Field label="ТС И ВОДИТЕЛЬ — из рейса, автоматически">
            <div style={{ ...iStyle, height: 'auto', minHeight: 38, padding: '9px 12px', display: 'flex', alignItems: 'center', color: '#5A6573', background: 'rgba(14,23,38,0.03)' }}>
              {tcLine || '— не задано в рейсе —'}
            </div>
          </Field>
        </div>

        {SECTIONS.map(sec => (
          <div key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionTitle title={sec.title} />
            <Grid2>
              {sec.fields.map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}>
                  <Field label={f.label}>{renderInput(f)}</Field>
                </div>
              ))}
            </Grid2>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button className="btn-primary" onClick={save} disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
            <SwapText>{saving ? 'Сохранение…' : editing ? 'Сохранить изменения' : 'Создать заявку →'}</SwapText>
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
