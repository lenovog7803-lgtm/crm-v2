import { useState, useEffect } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createOrder, getClients, getCarriers } from '../api'

export default function CreateOrderModal({ onClose, onSuccess }) {
  const [clients, setClients] = useState([])
  const [carriers, setCarriers] = useState([])
  const [form, setForm] = useState({
    route_from: '', route_to: '', client_id: '', carrier_id: '',
    client_rate: '', carrier_rate: '', cargo: '', weight_tons: '',
    load_date: '', unload_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getClients().then(r => setClients(Array.isArray(r) ? r : [])).catch(() => {})
    getCarriers().then(r => setCarriers(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.route_from || !form.route_to) return
    setLoading(true)
    setError('')
    try {
      await createOrder({
        route_from: form.route_from,
        route_to: form.route_to,
        client_id: form.client_id || undefined,
        carrier_id: form.carrier_id || undefined,
        client_rate: form.client_rate ? Number(form.client_rate) : 0,
        carrier_rate: form.carrier_rate ? Number(form.carrier_rate) : 0,
        cargo: form.cargo,
        weight_tons: form.weight_tons ? Number(form.weight_tons) : undefined,
        load_date: form.load_date || undefined,
        unload_date: form.unload_date || undefined,
        status: 'new',
      })
      onSuccess()
    } catch (e) {
      setError('Ошибка при создании заявки')
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Новая заявка" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ОТКУДА</label>
            <input className="form-input" placeholder="Город отправления" value={form.route_from} onChange={e => set('route_from', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">КУДА</label>
            <input className="form-input" placeholder="Город назначения" value={form.route_to} onChange={e => set('route_to', e.target.value)} required />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">КЛИЕНТ</label>
            <select className="form-input" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— Выберите —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">ПЕРЕВОЗЧИК</label>
            <select className="form-input" value={form.carrier_id} onChange={e => set('carrier_id', e.target.value)}>
              <option value="">— Выберите —</option>
              {carriers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">СТАВКА КЛИЕНТА (BYN)</label>
            <input className="form-input" type="number" placeholder="0" value={form.client_rate} onChange={e => set('client_rate', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">СТАВКА ПЕРЕВОЗЧИКА (BYN)</label>
            <input className="form-input" type="number" placeholder="0" value={form.carrier_rate} onChange={e => set('carrier_rate', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ГРУЗ</label>
            <input className="form-input" placeholder="Тип груза" value={form.cargo} onChange={e => set('cargo', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">ВЕС (т)</label>
            <input className="form-input" type="number" placeholder="20" value={form.weight_tons} onChange={e => set('weight_tons', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ДАТА ПОГРУЗКИ</label>
            <input className="form-input" type="date" value={form.load_date} onChange={e => set('load_date', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">ДАТА ДОСТАВКИ</label>
            <input className="form-input" type="date" value={form.unload_date} onChange={e => set('unload_date', e.target.value)} />
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Создание...' : 'Создать заявку'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
