import { useState } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createClient } from '../api'

export default function AddClientModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '', contact_person: '', phone: '', email: '', inn: '',
    legal_address: '', bank_name: '', bank_account: '', bank_bik: '', cargo_types: '', payment_terms: 'по факту',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name) return
    setLoading(true)
    setError('')
    try {
      await createClient(form)
      onSuccess()
    } catch (e) {
      setError('Ошибка при сохранении')
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Добавить клиента" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-field">
          <label className="form-label">НАИМЕНОВАНИЕ</label>
          <input className="form-input" placeholder="ООО «Компания»" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">КОНТАКТНОЕ ЛИЦО</label>
            <input className="form-input" placeholder="Фамилия И.О." value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">ТЕЛЕФОН</label>
            <input className="form-input" placeholder="+375 29 000-00-00" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">EMAIL</label>
            <input className="form-input" type="email" placeholder="email@company.by" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">УНП / ИНН</label>
            <input className="form-input" placeholder="100000000" value={form.inn} onChange={e => set('inn', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">ЮР. АДРЕС</label>
          <input className="form-input" placeholder="220001, Минск, ул. Ленина, 1" value={form.legal_address} onChange={e => set('legal_address', e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">БАНК</label>
          <input className="form-input" placeholder="Беларусбанк" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">РАСЧЁТНЫЙ СЧЁТ</label>
            <input className="form-input" placeholder="BY20AKBB..." value={form.bank_account} onChange={e => set('bank_account', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">БИК</label>
            <input className="form-input" placeholder="AKBBBY2X" value={form.bank_bik} onChange={e => set('bank_bik', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ГРУЗ</label>
            <input className="form-input" placeholder="Тип груза" value={form.cargo_types} onChange={e => set('cargo_types', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">УСЛОВИЯ ОПЛАТЫ</label>
            <select className="form-input" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
              <option>по факту</option>
              <option>14 дней</option>
              <option>30 дней</option>
              <option>45 дней</option>
            </select>
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Сохранение...' : 'Добавить клиента'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
