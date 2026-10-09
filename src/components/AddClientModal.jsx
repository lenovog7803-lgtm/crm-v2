import { useState } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createClient } from '../api'
import Select from './Select'
import { iosConfirm } from './IOSAlert'

const sectionLabel = {
  fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: '#0E1726',
  marginBottom: 2,
}

export default function AddClientModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '', contact_person: '', phone: '', email: '',
    unp: '', director: '', basis: 'Устава',
    legal_address: '', postal_address: '',
    bank_name: '', bank_account: '', bank_bik: '',
    cargo_types: '', payment_terms: 'по факту',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const set = (k, v) => { setIsDirty(true); setForm(f => ({ ...f, [k]: v })) }

  const handleClose = async () => {
    if (isDirty && !(await iosConfirm('Вы уверены? Изменения не сохранятся.'))) return
    onClose()
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name) return
    setLoading(true)
    setError('')
    try {
      await createClient(form)
      setIsDirty(false)
      onSuccess()
    } catch (e) {
      setError('Ошибка при сохранении')
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={handleClose}>
      <ModalHeader title="Добавить клиента" onClose={handleClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Основное */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Основное</div>
          <div className="form-field">
            <label className="form-label">Наименование</label>
            <input className="form-input" placeholder="ООО «Компания»" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">Контактное лицо</label>
              <input className="form-input" placeholder="Фамилия И.О." value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Телефон</label>
              <input className="form-input" placeholder="+375 29 000-00-00" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="email@company.by" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
        </div>

        {/* Реквизиты */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Реквизиты</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">УНП</label>
              <input className="form-input" placeholder="100000000" value={form.unp} onChange={e => set('unp', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Директор (Фамилия И.О.)</label>
              <input className="form-input" placeholder="Иванов И.И." value={form.director} onChange={e => set('director', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Действует на основании</label>
            <input className="form-input" placeholder="Устава" value={form.basis} onChange={e => set('basis', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Юридический адрес</label>
            <input className="form-input" placeholder="220001, г. Минск, ул. Ленина, д. 1" value={form.legal_address} onChange={e => set('legal_address', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Почтовый адрес</label>
            <input className="form-input" placeholder="220001, г. Минск, ул. Ленина, д. 1" value={form.postal_address} onChange={e => set('postal_address', e.target.value)} />
          </div>
        </div>

        {/* Банковские реквизиты */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Банковские реквизиты</div>
          <div className="form-field">
            <label className="form-label">Банк</label>
            <input className="form-input" placeholder="ОАО «АСБ Беларусбанк»" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">Расчётный счёт</label>
              <input className="form-input" placeholder="BY20AKBB..." value={form.bank_account} onChange={e => set('bank_account', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">БИК</label>
              <input className="form-input" placeholder="AKBBBY2X" value={form.bank_bik} onChange={e => set('bank_bik', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Доп */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Дополнительно</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">Груз</label>
              <input className="form-input" placeholder="Тип груза" value={form.cargo_types} onChange={e => set('cargo_types', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Условия оплаты</label>
              <Select className="form-input" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
                <option>по факту</option>
                <option>14 дней</option>
                <option>30 дней</option>
                <option>45 дней</option>
              </Select>
            </div>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" className="btn-ghost" onClick={handleClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Сохранение...' : 'Добавить клиента'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
