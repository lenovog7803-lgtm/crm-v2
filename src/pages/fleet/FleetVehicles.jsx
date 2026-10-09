import { useState, useEffect } from 'react'
import {
  getFleetVehicles, createFleetVehicle, updateFleetVehicle, deleteFleetVehicle,
  getFleetDrivers, createFleetDriver, updateFleetDriver, deleteFleetDriver,
} from '../../api'
import { useToast } from '../../components/Toast'
import { SlidingTabs } from '../../components/SlidingTabs'
import { Loader } from '../../components/Loader'

const fieldStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #E8EAEE', fontSize: 13, background: '#FFFFFF', boxSizing: 'border-box', width: '100%' }

const VEHICLE_SECTIONS = [
  { fields: [
    { key: 'model', label: 'Модель машины', full: true },
    { key: 'plate', label: 'Гос. номер' },
    { key: 'capacity_tons', label: 'Грузоподъёмность, т', type: 'number' },
  ] },
  { title: 'Габариты, м', cols: 3, fields: [
    { key: 'length_m', label: 'Длина', type: 'number' },
    { key: 'width_m', label: 'Ширина', type: 'number' },
    { key: 'height_m', label: 'Высота', type: 'number' },
  ] },
]

const DRIVER_SECTIONS = [
  { fields: [{ key: 'name', label: 'ФИО', full: true }] },
  { title: 'Паспортные данные', fields: [
    { key: 'passport', label: 'Номер паспорта', full: true },
    { key: 'passport_issued_by', label: 'Кем выдан', full: true },
    { key: 'passport_issue_date', label: 'Дата выдачи', type: 'date' },
  ] },
  { title: 'Телефоны', fields: [
    { key: 'phone_ru', label: 'Телефон РУ' },
    { key: 'phone_by', label: 'Телефон БАЙ' },
  ] },
]

function EntityModal({ title, sections, initial, onClose, onSave }) {
  const { show } = useToast()
  const allFields = sections.flatMap(s => s.fields)
  const [form, setForm] = useState(() =>
    Object.fromEntries(allFields.map(f => [f.key, initial?.[f.key] ?? '']))
  )
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const firstKey = allFields[0].key

  const submit = async () => {
    if (!String(form[firstKey] ?? '').trim() || saving) return
    setSaving(true)
    try {
      const data = { ...form }
      for (const f of allFields) {
        if (f.type === 'number') data[f.key] = data[f.key] === '' || data[f.key] == null ? undefined : Number(data[f.key])
      }
      await onSave(data)
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 480, padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 17, color: '#0E1726', marginBottom: 18 }}>{title}</div>

        {sections.map((sec, si) => (
          <div key={si} style={si > 0 ? { marginTop: 16, paddingTop: 14, borderTop: '1px solid #F0F1F4' } : undefined}>
            {sec.title && (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                {sec.title}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sec.cols || 2}, 1fr)`, gap: 10 }}>
              {sec.fields.map((f, i) => (
                <input
                  key={f.key}
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.label}
                  type={f.type || 'text'}
                  autoFocus={si === 0 && i === 0}
                  style={{ ...fieldStyle, gridColumn: f.full ? '1 / -1' : 'auto' }}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
          <button onClick={submit} disabled={saving} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: '#1366F0', color: '#fff', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Сохраняю…' : initial ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FleetVehicles() {
  const { show } = useToast()
  const [tab, setTab] = useState('vehicles')
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { kind: 'vehicle'|'driver', item?: {...} }

  const reload = () => {
    setLoading(true)
    Promise.all([
      getFleetVehicles().then(r => setVehicles(r.vehicles || [])).catch(() => {}),
      getFleetDrivers().then(r => setDrivers(r.drivers || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  const removeVehicle = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Удалить машину?')) return
    try { await deleteFleetVehicle(id); setVehicles(p => p.filter(v => v.id !== id)) }
    catch (err) { show('Ошибка: ' + err.message, { type: 'error' }) }
  }
  const removeDriver = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Удалить водителя?')) return
    try { await deleteFleetDriver(id); setDrivers(p => p.filter(d => d.id !== id)) }
    catch (err) { show('Ошибка: ' + err.message, { type: 'error' }) }
  }

  const cardStyle = { padding: 18, cursor: 'pointer' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 22, color: '#0E1726' }}>Машины и водители</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Свой автопарк</div>
        </div>
        <button onClick={() => setModal({ kind: tab === 'vehicles' ? 'vehicle' : 'driver' })} className="btn-primary">
          + {tab === 'vehicles' ? 'Машина' : 'Водитель'}
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SlidingTabs
          options={[{ key: 'vehicles', label: `Машины (${vehicles.length})` }, { key: 'drivers', label: `Водители (${drivers.length})` }]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {loading ? (
        <Loader padding={20} />
      ) : tab === 'vehicles' ? (
        vehicles.length === 0 ? (
          <div className="card" style={{ color: '#A6AEB8', fontSize: 13, padding: 40, textAlign: 'center' }}>Машин пока нет.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {vehicles.map(v => {
              const dims = [v.length_m, v.width_m, v.height_m].filter(x => x || x === 0)
              return (
                <div key={v.id} className="card" style={cardStyle} onClick={() => setModal({ kind: 'vehicle', item: v })} title="Нажмите, чтобы изменить">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>{v.model || v.brand || '—'}</div>
                    <button onClick={e => removeVehicle(e, v.id)} style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                  {(v.plate || v.plate_truck) && <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#5A6573', marginTop: 4 }}>{v.plate || v.plate_truck}</div>}
                  {v.capacity_tons ? <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 6 }}>{v.capacity_tons} т</div> : null}
                  {dims.length === 3 && <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>{dims.join(' × ')} м</div>}
                </div>
              )
            })}
          </div>
        )
      ) : (
        drivers.length === 0 ? (
          <div className="card" style={{ color: '#A6AEB8', fontSize: 13, padding: 40, textAlign: 'center' }}>Водителей пока нет.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {drivers.map(d => (
              <div key={d.id} className="card" style={cardStyle} onClick={() => setModal({ kind: 'driver', item: d })} title="Нажмите, чтобы изменить">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>{d.name}</div>
                  <button onClick={e => removeDriver(e, d.id)} style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
                {(d.phone_ru || d.phone_by || d.phone) && (
                  <div style={{ fontSize: 12, color: '#5A6573', marginTop: 6 }}>
                    {[d.phone_ru && `РУ ${d.phone_ru}`, d.phone_by && `БАЙ ${d.phone_by}`, !d.phone_ru && !d.phone_by && d.phone].filter(Boolean).join(' · ')}
                  </div>
                )}
                {d.passport && (
                  <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>
                    № {d.passport}{d.passport_issued_by ? `, выдан ${d.passport_issued_by}` : ''}{d.passport_issue_date ? `, ${d.passport_issue_date}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {modal?.kind === 'vehicle' && (
        <EntityModal
          title={modal.item ? 'Изменить машину' : 'Новая машина'}
          sections={VEHICLE_SECTIONS}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.item) await updateFleetVehicle(modal.item.id, data)
            else await createFleetVehicle(data)
            setModal(null); reload()
          }}
        />
      )}
      {modal?.kind === 'driver' && (
        <EntityModal
          title={modal.item ? 'Изменить водителя' : 'Новый водитель'}
          sections={DRIVER_SECTIONS}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.item) await updateFleetDriver(modal.item.id, data)
            else await createFleetDriver(data)
            setModal(null); reload()
          }}
        />
      )}
    </div>
  )
}
