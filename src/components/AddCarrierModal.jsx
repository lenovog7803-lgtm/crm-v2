import { useState } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createCarrier } from '../api'

export default function AddCarrierModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    company_name: '', driver_name: '', phone: '', unp: '',
    capacity_tons: '', vehicle_type: '', plate: '', regions: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.company_name) return
    setLoading(true)
    setError('')
    try {
      await createCarrier({
        ...form,
        capacity_tons: form.capacity_tons ? parseFloat(form.capacity_tons) : 0,
        rating: 5.0,
      })
      onSuccess()
    } catch (e) {
      setError('Ошибка при сохранении')
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Добавить перевозчика" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-field">
          <label className="form-label">НАИМЕНОВАНИЕ</label>
          <input className="form-input" placeholder="ИП Иванов / ООО «ТрансЛайн»" value={form.company_name} onChange={e => set('company_name', e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ВОДИТЕЛЬ</label>
            <input className="form-input" placeholder="Фамилия И.О." value={form.driver_name} onChange={e => set('driver_name', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">ТЕЛЕФОН</label>
            <input className="form-input" placeholder="+375 29 000-00-00" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">УНП</label>
            <input className="form-input" placeholder="100000000" value={form.unp} onChange={e => set('unp', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">ГРУЗОПОДЪЁМНОСТЬ (т)</label>
            <input className="form-input" type="number" placeholder="20" value={form.capacity_tons} onChange={e => set('capacity_tons', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ТИП ТС</label>
            <input className="form-input" placeholder="Тент / Реф / Контейнер" value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">НОМЕР ТС</label>
            <input className="form-input" placeholder="АВ 1234-7" value={form.plate} onChange={e => set('plate', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">РЕГИОНЫ РАБОТЫ</label>
          <input className="form-input" placeholder="РБ, РФ, ЕС" value={form.regions} onChange={e => set('regions', e.target.value)} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Сохранение...' : 'Добавить перевозчика'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
