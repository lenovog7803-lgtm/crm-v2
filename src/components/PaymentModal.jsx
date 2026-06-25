import { useState, useEffect } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createPaymentIn, createPaymentOut, getClients, getCarriers } from '../api'

export default function PaymentModal({ defaultKind, onClose, onSuccess }) {
  const [clients, setClients] = useState([])
  const [carriers, setCarriers] = useState([])
  const [form, setForm] = useState({
    kind: defaultKind || 'income',
    party: defaultKind === 'expense' ? 'carrier' : 'client',
    partyId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    pp_number: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getClients().then(r => setClients(Array.isArray(r) ? r : [])).catch(() => {})
    getCarriers().then(r => setCarriers(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const partyList = form.party === 'client' ? clients : carriers

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.partyId || !form.amount) return
    setLoading(true)
    setError('')
    try {
      const payload = { amount: Number(form.amount), date: form.date, pp_number: form.pp_number }
      if (form.kind === 'income') {
        await createPaymentIn({ ...payload, client_id: form.partyId })
      } else {
        await createPaymentOut({ ...payload, carrier_id: form.partyId })
      }
      onSuccess()
    } catch (e) {
      setError('Ошибка при сохранении платежа')
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={form.kind === 'income' ? 'Поступление' : 'Списание'} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ТИП</label>
            <select className="form-input" value={form.kind} onChange={e => {
              const k = e.target.value
              set('kind', k)
              set('party', k === 'expense' ? 'carrier' : 'client')
              set('partyId', '')
            }}>
              <option value="income">Поступление</option>
              <option value="expense">Списание</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">СТОРОНА</label>
            <select className="form-input" value={form.party} onChange={e => { set('party', e.target.value); set('partyId', '') }}>
              <option value="client">Клиент</option>
              <option value="carrier">Перевозчик</option>
            </select>
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">КОНТРАГЕНТ</label>
          <select className="form-input" value={form.partyId} onChange={e => set('partyId', e.target.value)} required>
            <option value="">— Выберите —</option>
            {partyList.map(p => <option key={p.id} value={p.id}>{p.name || p.company_name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">СУММА (BYN)</label>
            <input className="form-input" type="number" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">ДАТА</label>
            <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">НОМЕР ПП</label>
          <input className="form-input" placeholder="ПП №1234" value={form.pp_number} onChange={e => set('pp_number', e.target.value)} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Сохранение...' : form.kind === 'income' ? 'Добавить поступление' : 'Добавить списание'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
