import { useState, useEffect } from 'react'
import { getFleetTrips, createFleetTrip, getFleetVehicles, getFleetDrivers } from '../../api'
import { useToast } from '../../components/Toast'
import { TRIP_STATUS } from './FleetTripDetail'
import { mouseOnly } from '../../motion'
import { Loader } from '../../components/Loader'
import Select from '../../components/Select'
import { EmptyState } from '../../components/EmptyState'

const fieldStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #E8EAEE', fontSize: 13, background: '#FFFFFF', boxSizing: 'border-box', width: '100%' }

function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString('ru-RU')
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const monthKey = t => String(t.first_load_date || t.created_at || '').slice(0, 7)
const monthTitle = k => { if (!k) return 'Без даты'; const [y, m] = k.split('-'); return `${MONTHS_RU[+m - 1] || m} ${y}` }
function groupByMonth(trips) {
  const map = new Map()
  for (const t of trips) {
    const k = monthKey(t)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(t)
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

function CreateTripModal({ onClose, onCreated }) {
  const { show } = useToast()
  const [form, setForm] = useState({ name: '', route_from: '', route_to: '', vehicle_id: '', driver_id: '' })
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    getFleetVehicles().then(r => setVehicles(r.vehicles || [])).catch(() => {})
    getFleetDrivers().then(r => setDrivers(r.drivers || [])).catch(() => {})
  }, [])

  const save = async () => {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const trip = await createFleetTrip({
        name: form.name.trim(),
        route_from: form.route_from.trim(),
        route_to: form.route_to.trim(),
        vehicle_id: form.vehicle_id,
        driver_id: form.driver_id,
      })
      onCreated(trip)
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 460, padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)' }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: '#0E1726', marginBottom: 18 }}>Новый рейс</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="Название рейса, напр. Минск–Москва" style={fieldStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={form.route_from} onChange={e => set('route_from', e.target.value)} placeholder="Откуда" style={fieldStyle} />
            <input value={form.route_to} onChange={e => set('route_to', e.target.value)} placeholder="Куда" style={fieldStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Select value={form.vehicle_id} onChange={e => set('vehicle_id', e.target.value)} style={fieldStyle}>
              <option value="">Машина на рейс</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{[v.model, v.plate || v.plate_truck].filter(Boolean).join(' · ') || v.id.slice(0, 6)}</option>)}
            </Select>
            <Select value={form.driver_id} onChange={e => set('driver_id', e.target.value)} style={fieldStyle}>
              <option value="">Водитель на рейс</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <div style={{ fontSize: 11, color: '#A6AEB8' }}>Машина и водитель подставятся в каждый заказ этого рейса — в самом заказе можно поменять.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
          <button onClick={save} disabled={saving || !form.name.trim()} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: form.name.trim() ? '#1366F0' : '#C4CAD4', color: '#fff', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Создаю…' : 'Создать рейс'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FleetTrips({ onOpenTrip }) {
  const { show } = useToast()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    getFleetTrips()
      .then(r => setTrips(r.trips || []))
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }, [show])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 22, color: '#0E1726' }}>Рейсы</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Свой автопарк</div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Новый рейс
        </button>
      </div>

      {loading ? (
        <Loader padding={20} />
      ) : trips.length === 0 ? (
        <div className="card"><EmptyState title="Рейсов пока нет" subtitle="Создайте первый рейс — в нём будут направления и заказы" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groupByMonth(trips).map(([mk, monthTrips]) => (
            <div key={mk}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', textTransform: 'uppercase', marginBottom: 10 }}>
                {monthTitle(mk)} · {monthTrips.length}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {monthTrips.map(t => (
                  <div key={t.id} className="card" onClick={() => onOpenTrip(t.id)} style={{ padding: 18, cursor: 'pointer' }}
                    onPointerEnter={mouseOnly(e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 50px -20px rgba(20,30,55,0.25)' })}
                    onPointerLeave={mouseOnly(e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '' })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 15, color: '#0E1726', flex: 1, minWidth: 0 }}>
                        {t.trip_number ? <span style={{ fontFamily: 'var(--font-mono)', color: '#1366F0', fontSize: 13, marginRight: 6 }}>Р{t.trip_number}</span> : null}
                        {t.name || 'Без названия'}
                      </div>
                      {(() => { const s = TRIP_STATUS.find(x => x.key === (t.status || 'active')) || TRIP_STATUS[0]; return (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: `${s.color}1a`, borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>{s.label}</span>
                      ) })()}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#5A6573', marginBottom: 4 }}>
                      {(t.route_from || '—')} → {(t.route_to || '—')}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#A6AEB8', marginBottom: 12 }}>
                      {fmtDate(t.first_load_date)} – {fmtDate(t.last_unload_date)}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#1366F0' }}>
                      {(t.total_amount || 0).toLocaleString('ru-RU')} Br
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTripModal
          onClose={() => setShowCreate(false)}
          onCreated={trip => { setTrips(prev => [trip, ...prev]); setShowCreate(false); onOpenTrip(trip.id) }}
        />
      )}
    </div>
  )
}
