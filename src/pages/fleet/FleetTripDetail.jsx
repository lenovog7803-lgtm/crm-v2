import { useState, useEffect, useCallback } from 'react'
import {
  getFleetTrip, updateFleetTrip, deleteFleetTrip, deleteFleetOrder,
  getFleetVehicles, getFleetDrivers, duplicateFleetTrip, duplicateFleetOrder,
  addFleetDriverPayout, deleteFleetDriverPayout, addFleetComment, deleteFleetComment,
} from '../../api'
import { useToast } from '../../components/Toast'
import { FleetOrderModal, fmtDate } from './FleetOrderModal'
import { SlidingTabs } from '../../components/SlidingTabs'
import { PillBtn } from './fleetUi'
import { Loader } from '../../components/Loader'

const fieldStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #E8EAEE', fontSize: 13, background: '#FFFFFF', boxSizing: 'border-box' }
const num = v => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v))

export const TRIP_STATUS = [
  { key: 'active', label: 'Активный', color: '#1366F0' },
  { key: 'in_transit', label: 'В пути', color: '#D97706' },
  { key: 'delivered', label: 'Доставлен', color: '#1E9E5A' },
]
const money = v => num(v).toLocaleString('ru-RU')

const EXPENSE_KINDS = [
  'Платные дороги', 'Суточные водителю', 'Штрафы', 'Мойка', 'Стоянка / парковка',
  'Паром / переправа', 'Погрузка / разгрузка', 'Ремонт в пути', 'Весовой контроль', 'Прочее',
]

const SALARY_MODES = [
  { key: '', label: 'Не считать' },
  { key: 'per_km', label: 'За км' },
  { key: 'percent', label: '% от выручки' },
  { key: 'fixed', label: 'Фикс за рейс' },
]

function niceInput(props) {
  return <input {...props} style={{ ...fieldStyle, width: '100%', ...(props.style || {}) }} />
}

const stat = (label, value, color = '#0E1726') => (
  <div style={{ background: 'rgba(14,23,38,0.03)', borderRadius: 12, padding: '10px 14px', minWidth: 0 }}>
    <div style={{ fontSize: 10.5, color: '#A6AEB8', fontWeight: 600, marginBottom: 4 }}>{label}</div>
    <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 15, color }}>{value}</div>
  </div>
)

// Раздел «Информация о рейсе» — пробег, топливо, все расходы (с отметкой
// оплаты и чеком), ЗП водителя, выплаты водителю, и итог.
function TripInfoCard({ trip, revenue, finance, onSave, onReload }) {
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    odo_start: trip.odo_start ?? '', odo_end: trip.odo_end ?? '',
    fuel_liters: trip.fuel_liters ?? '', fuel_cost: trip.fuel_cost ?? '',
    fuel_receipts: trip.fuel_receipts ?? '',
    fuel_paid: !!trip.fuel_paid, fuel_paid_by: trip.fuel_paid_by ?? '',
    expenses: Array.isArray(trip.expenses) ? trip.expenses : [],
    driver_notes: trip.driver_notes ?? '',
    driver_salary_mode: trip.driver_salary_mode ?? '',
    driver_salary_rate: trip.driver_salary_rate ?? '',
    driver_advance: trip.driver_advance ?? '',
  })
  const [dirty, setDirty] = useState(false)
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setDirty(true) }

  useEffect(() => {
    setF({
      odo_start: trip.odo_start ?? '', odo_end: trip.odo_end ?? '',
      fuel_liters: trip.fuel_liters ?? '', fuel_cost: trip.fuel_cost ?? '',
      fuel_receipts: trip.fuel_receipts ?? '',
      fuel_paid: !!trip.fuel_paid, fuel_paid_by: trip.fuel_paid_by ?? '',
      expenses: Array.isArray(trip.expenses) ? trip.expenses : [],
      driver_notes: trip.driver_notes ?? '',
      driver_salary_mode: trip.driver_salary_mode ?? '',
      driver_salary_rate: trip.driver_salary_rate ?? '',
      driver_advance: trip.driver_advance ?? '',
    })
    setDirty(false)
  }, [trip])

  const km = Math.max(0, num(f.odo_end) - num(f.odo_start))
  const per100 = km > 0 && num(f.fuel_liters) > 0 ? (num(f.fuel_liters) / km * 100) : 0
  const expTotal = f.expenses.reduce((s, e) => s + num(e.amount), 0)

  // ЗП водителя — тот же расчёт, что на бэкенде.
  const salary = f.driver_salary_mode === 'per_km' ? num(f.driver_salary_rate) * km
    : f.driver_salary_mode === 'percent' ? num(f.driver_salary_rate) / 100 * num(revenue)
    : f.driver_salary_mode === 'fixed' ? num(f.driver_salary_rate)
    : 0
  const payouts = Array.isArray(trip.driver_payouts) ? trip.driver_payouts : []
  const driverPaid = num(f.driver_advance) + payouts.reduce((s, p) => s + num(p.amount), 0)
  const driverDebt = salary - driverPaid

  const totalCost = num(f.fuel_cost) + expTotal + salary
  const profit = num(revenue) - totalCost
  const expPaid = (f.fuel_paid ? num(f.fuel_cost) : 0)
    + f.expenses.filter(e => e.paid).reduce((s, e) => s + num(e.amount), 0) + driverPaid
  const expUnpaid = totalCost - expPaid

  const persist = (next = f) => {
    onSave({
      odo_start: num(next.odo_start), odo_end: num(next.odo_end),
      fuel_liters: num(next.fuel_liters), fuel_cost: num(next.fuel_cost),
      fuel_receipts: num(next.fuel_receipts),
      fuel_paid: !!next.fuel_paid, fuel_paid_by: next.fuel_paid_by,
      expenses: next.expenses,
      driver_notes: next.driver_notes,
      driver_salary_mode: next.driver_salary_mode,
      driver_salary_rate: num(next.driver_salary_rate),
      driver_advance: num(next.driver_advance),
    })
    setDirty(false)
  }
  const addExpense = () => { const next = { ...f, expenses: [...f.expenses, { id: crypto.randomUUID(), kind: EXPENSE_KINDS[0], amount: '', note: '', paid: false, paid_by: '', receipt_url: '' }] }; setF(next); setDirty(true) }
  const setExpense = (id, k, v) => setF(p => ({ ...p, expenses: p.expenses.map(e => e.id === id ? { ...e, [k]: v } : e) }))
  const delExpense = (id) => { const next = { ...f, expenses: f.expenses.filter(e => e.id !== id) }; setF(next); persist(next) }
  const toggleExpensePaid = (id) => {
    const next = { ...f, expenses: f.expenses.map(e => e.id === id ? { ...e, paid: !e.paid } : e) }
    setF(next); persist(next)
  }

  const addPayout = async (kind) => {
    const raw = window.prompt(kind === 'advance' ? 'Аванс водителю, Br:' : 'Выплата водителю, Br:')
    if (!raw) return
    const amount = Number(raw.replace(',', '.'))
    if (!amount || amount <= 0) { show('Неверная сумма', { type: 'error' }); return }
    try {
      await addFleetDriverPayout(trip.id, { amount, kind, date: new Date().toISOString().slice(0, 10) })
      onReload()
      show(kind === 'advance' ? 'Аванс записан' : 'Выплата записана', { type: 'success' })
    } catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  const removePayout = async (pid) => {
    if (!window.confirm('Удалить выплату?')) return
    try { await deleteFleetDriverPayout(trip.id, pid); onReload() }
    catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', background: open ? 'rgba(14,23,38,0.03)' : 'transparent' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1726' }}>Информация о рейсе · финансы</div>
          <div style={{ fontSize: 11, color: '#8A93A0', marginTop: 1 }}>
            {km > 0 ? `${km.toLocaleString('ru-RU')} км · ` : ''}расходы {money(totalCost)} Br
            {expUnpaid > 0.5 ? ` · не оплачено ${money(expUnpaid)} Br` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#A6AEB8', fontWeight: 600 }}>ПРИБЫЛЬ</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 14, color: profit >= 0 ? '#1E9E5A' : '#E0473B' }}>{money(profit)} Br</div>
        </div>
      </div>

      {!open ? null : (
      <div style={{ padding: '16px 18px 20px', borderTop: '1px solid #F0F1F4' }}>
      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={() => persist()} className="btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>Сохранить</button>
        </div>
      )}

      {/* Пробег + топливо */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Пробег в начале, км</div>
          {niceInput({ type: 'number', value: f.odo_start, onChange: e => set('odo_start', e.target.value), onBlur: () => dirty && persist() })}</div>
        <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Пробег в конце, км</div>
          {niceInput({ type: 'number', value: f.odo_end, onChange: e => set('odo_end', e.target.value), onBlur: () => dirty && persist() })}</div>
        <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Заправка, литров</div>
          {niceInput({ type: 'number', value: f.fuel_liters, onChange: e => set('fuel_liters', e.target.value), onBlur: () => dirty && persist() })}</div>
        <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Топливо, сумма BYN</div>
          {niceInput({ type: 'number', value: f.fuel_cost, onChange: e => set('fuel_cost', e.target.value), onBlur: () => dirty && persist() })}</div>
        <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Чеков на заправку</div>
          {niceInput({ type: 'number', value: f.fuel_receipts, onChange: e => set('fuel_receipts', e.target.value), onBlur: () => dirty && persist() })}</div>
        <div>
          <div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Топливо оплачено?</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => { const n = { ...f, fuel_paid: !f.fuel_paid }; setF(n); persist(n) }}
              style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid', borderColor: f.fuel_paid ? '#1E9E5A' : '#E8EAEE', background: f.fuel_paid ? 'rgba(30,158,90,0.1)' : '#fff', color: f.fuel_paid ? '#1E9E5A' : '#8A93A0', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {f.fuel_paid ? '✓ оплачено' : 'не оплачено'}
            </button>
            <input value={f.fuel_paid_by} placeholder="кто платил" onChange={e => set('fuel_paid_by', e.target.value)} onBlur={() => dirty && persist()} style={{ ...fieldStyle, flex: 1, minWidth: 0 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {stat('Пройдено', `${km.toLocaleString('ru-RU')} км`, '#1366F0')}
        {stat('Расход', per100 ? `${per100.toFixed(1)} л/100км` : '—')}
        {stat('Топливо', `${money(f.fuel_cost)} Br`)}
      </div>

      {/* Прочие расходы — с отметкой оплаты и чеком */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E1726' }}>Расходы по рейсу</div>
        <button onClick={addExpense} style={{ border: '1px solid #1366F0', background: 'transparent', color: '#1366F0', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ расход</button>
      </div>
      {f.expenses.length === 0 && <div style={{ fontSize: 12, color: '#A6AEB8', padding: '4px 0 10px' }}>Платные дороги, суточные, штрафы, мойка, паром и т.д.</div>}
      {f.expenses.map(e => (
        <div key={e.id} style={{ borderBottom: '1px solid #F4F5F7', padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <select value={e.kind} onChange={ev => setExpense(e.id, 'kind', ev.target.value)} onBlur={() => persist()} style={{ ...fieldStyle, flex: '1 1 140px' }}>
              {EXPENSE_KINDS.map(k => <option key={k}>{k}</option>)}
            </select>
            <input type="number" value={e.amount} placeholder="BYN" onChange={ev => setExpense(e.id, 'amount', ev.target.value)} onBlur={() => persist()} style={{ ...fieldStyle, width: 100 }} />
            <button onClick={() => delExpense(e.id)} style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => toggleExpensePaid(e.id)}
              style={{ padding: '7px 11px', borderRadius: 9, border: '1px solid', borderColor: e.paid ? '#1E9E5A' : '#E8EAEE', background: e.paid ? 'rgba(30,158,90,0.1)' : '#fff', color: e.paid ? '#1E9E5A' : '#8A93A0', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {e.paid ? '✓ оплачено' : 'не оплачено'}
            </button>
            <input value={e.paid_by || ''} placeholder="кто платил" onChange={ev => setExpense(e.id, 'paid_by', ev.target.value)} onBlur={() => persist()} style={{ ...fieldStyle, flex: '1 1 110px', minWidth: 0, padding: '7px 10px' }} />
            <input value={e.receipt_url || ''} placeholder="ссылка на чек" onChange={ev => setExpense(e.id, 'receipt_url', ev.target.value)} onBlur={() => persist()} style={{ ...fieldStyle, flex: '2 1 140px', minWidth: 0, padding: '7px 10px' }} />
            <input value={e.note || ''} placeholder="примечание" onChange={ev => setExpense(e.id, 'note', ev.target.value)} onBlur={() => persist()} style={{ ...fieldStyle, flex: '2 1 120px', minWidth: 0, padding: '7px 10px' }} />
          </div>
        </div>
      ))}

      {/* ЗП водителя */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F0F1F4' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E1726', marginBottom: 8 }}>Зарплата водителя за рейс</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Как считать</div>
            <select value={f.driver_salary_mode} onChange={e => { const n = { ...f, driver_salary_mode: e.target.value }; setF(n); setDirty(true) }} onBlur={() => dirty && persist()} style={{ ...fieldStyle, width: '100%' }}>
              {SALARY_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          {f.driver_salary_mode && (
            <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>
              {f.driver_salary_mode === 'per_km' ? 'Ставка, Br/км' : f.driver_salary_mode === 'percent' ? 'Процент, %' : 'Сумма, Br'}
            </div>
            {niceInput({ type: 'number', value: f.driver_salary_rate, onChange: e => set('driver_salary_rate', e.target.value), onBlur: () => dirty && persist() })}</div>
          )}
          <div><div style={{ fontSize: 11, color: '#8A93A0', marginBottom: 4 }}>Аванс, Br</div>
            {niceInput({ type: 'number', value: f.driver_advance, onChange: e => set('driver_advance', e.target.value), onBlur: () => dirty && persist() })}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 12 }}>
          {stat('Начислено', `${money(salary)} Br`)}
          {stat('Выплачено', `${money(driverPaid)} Br`, '#1E9E5A')}
          {stat('Долг водителю', `${money(driverDebt)} Br`, driverDebt > 0.5 ? '#D97706' : '#1E9E5A')}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => addPayout('advance')} style={{ border: '1px solid #E8EAEE', background: '#fff', color: '#5A6573', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ аванс</button>
          <button onClick={() => addPayout('payout')} style={{ border: '1px solid #1E9E5A', background: 'rgba(30,158,90,0.08)', color: '#1E9E5A', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ выплата</button>
        </div>
        {payouts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {payouts.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#5A6573', padding: '5px 0', borderBottom: '1px solid #F4F5F7' }}>
                <span>{p.kind === 'advance' ? 'Аванс' : 'Выплата'} · {fmtDate(p.date)}</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <b style={{ fontFamily: 'JetBrains Mono', color: '#0E1726' }}>{money(p.amount)} Br</b>
                  <button onClick={() => removePayout(p.id)} style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Итог */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0F1F4', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        {stat('Выручка', `${money(revenue)} Br`, '#1E9E5A')}
        {stat('Получено', `${money(finance?.received ?? 0)} Br`, '#1366F0')}
        {stat('Расходы', `${money(totalCost)} Br`, '#E0473B')}
        {stat('Не оплачено', `${money(expUnpaid)} Br`, expUnpaid > 0.5 ? '#D97706' : '#1E9E5A')}
        {stat('Прибыль', `${money(profit)} Br`, profit >= 0 ? '#1E9E5A' : '#E0473B')}
      </div>
      </div>
      )}
    </div>
  )
}

// Комментарии к рейсу
function CommentsCard({ entity, id, comments, onReload }) {
  const { show } = useToast()
  const [text, setText] = useState('')
  const list = Array.isArray(comments) ? comments : []
  const add = async () => {
    if (!text.trim()) return
    try { await addFleetComment(entity, id, text.trim()); setText(''); onReload() }
    catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  const del = async (cid) => {
    try { await deleteFleetComment(entity, id, cid); onReload() }
    catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0E1726', marginBottom: 10 }}>Комментарии</div>
      {list.map(c => (
        <div key={c.id} style={{ padding: '7px 0', borderBottom: '1px solid #F4F5F7', fontSize: 12.5, color: '#3A424E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: '#8A93A0', fontSize: 11 }}>{c.author || '—'} · {fmtDate(c.created_at)}</span>
            <button onClick={() => del(c.id)} style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
          <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{c.text}</div>
        </div>
      ))}
      {list.length === 0 && <div style={{ fontSize: 12, color: '#A6AEB8', padding: '2px 0 10px' }}>Пока нет</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Добавить комментарий…" style={{ ...fieldStyle, flex: 1 }} />
        <button onClick={add} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}>ОК</button>
      </div>
    </div>
  )
}

function EditTripModal({ trip, onClose, onSaved }) {
  const { show } = useToast()
  const [form, setForm] = useState({
    name: trip.name || '', route_from: trip.route_from || '', route_to: trip.route_to || '',
    vehicle_id: trip.vehicle_id || '', driver_id: trip.driver_id || '',
  })
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
      const updated = await updateFleetTrip(trip.id, {
        name: form.name.trim(), route_from: form.route_from.trim(), route_to: form.route_to.trim(),
        vehicle_id: form.vehicle_id, driver_id: form.driver_id,
      })
      onSaved(updated)
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 460, padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 17, color: '#0E1726', marginBottom: 18 }}>Изменить рейс</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="Название рейса" style={{ ...fieldStyle, width: '100%' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={form.route_from} onChange={e => set('route_from', e.target.value)} placeholder="Откуда" style={fieldStyle} />
            <input value={form.route_to} onChange={e => set('route_to', e.target.value)} placeholder="Куда" style={fieldStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={form.vehicle_id} onChange={e => set('vehicle_id', e.target.value)} style={fieldStyle}>
              <option value="">Машина на рейс</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{[v.model, v.plate || v.plate_truck].filter(Boolean).join(' · ') || v.id.slice(0, 6)}</option>)}
            </select>
            <select value={form.driver_id} onChange={e => set('driver_id', e.target.value)} style={fieldStyle}>
              <option value="">Водитель на рейс</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
          <button onClick={save} disabled={saving || !form.name.trim()} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: form.name.trim() ? '#1366F0' : '#C4CAD4', color: '#fff', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FleetOrderCard({ order, onReload, onOpen }) {
  const { show } = useToast()
  const remove = async (e) => {
    e.stopPropagation()
    if (!window.confirm('Удалить заказ?')) return
    try {
      await deleteFleetOrder(order.id)
      onReload()
    } catch (err) {
      show('Ошибка: ' + err.message, { type: 'error' })
    }
  }
  const dup = async (e) => {
    e.stopPropagation()
    try { await duplicateFleetOrder(order.id); onReload(); show('Заказ продублирован', { type: 'success' }) }
    catch (err) { show('Ошибка: ' + err.message, { type: 'error' }) }
  }
  const rate = order.rate || 0
  const paidAmt = order.paid_amount ?? (order.paid ? rate : 0)
  const payState = order.paid ? { t: 'оплачен', c: '#1E9E5A', bg: 'rgba(30,158,90,0.1)' }
    : paidAmt > 0 ? { t: `${paidAmt.toLocaleString('ru-RU')} из ${rate.toLocaleString('ru-RU')}`, c: '#D97706', bg: 'rgba(217,119,6,0.1)' }
    : { t: 'не оплачен', c: '#8A93A0', bg: 'rgba(14,23,38,0.05)' }
  return (
    <div
      onClick={() => onOpen?.(order.id)}
      title="Открыть карточку загрузки"
      style={{ padding: '10px 0', borderBottom: '1px solid #F0F1F4', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726' }}>
          {order.order_number && <span style={{ fontFamily: 'JetBrains Mono', color: '#1366F0', fontSize: 12, marginRight: 6 }}>{order.order_number}</span>}
          {order.client_name || 'Клиент не указан'}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={dup} title="Дублировать" style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>⧉</button>
          <button onClick={remove} title="Удалить" style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>
      </div>
      {(order.loading_address || order.unloading_address) && (
        <div style={{ fontSize: 11, color: '#8A93A0', marginTop: 2 }}>
          {order.loading_address || '—'} → {order.unloading_address || '—'}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#8A93A0', marginTop: 2 }}>
        {order.weight_tons || 0} т · {order.pallets_count || 0} палет · {order.volume_m3 || 0} м³
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#8A93A0' }}>{fmtDate(order.load_date)} → {fmtDate(order.unload_date)}</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: payState.c, background: payState.bg, borderRadius: 6, padding: '2px 7px' }}>{payState.t}</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#1366F0' }}>{rate.toLocaleString('ru-RU')} Br</span>
        </span>
      </div>
    </div>
  )
}

function DirectionSection({ title, orders, onAdd, onReload, onOpen }) {
  const total = orders.reduce((s, o) => s + (o.rate || 0), 0)
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1726' }}>{title}</div>
        <button onClick={onAdd} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #1366F0', background: 'transparent', color: '#1366F0', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>+</button>
      </div>
      {orders.map(o => <FleetOrderCard key={o.id} order={o} onReload={onReload} onOpen={onOpen} />)}
      {orders.length === 0 && <div style={{ fontSize: 12, color: '#A6AEB8', textAlign: 'center', padding: 20 }}>Заказов пока нет</div>}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F1F4', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: '#8A93A0' }}>Итого</span>
        <span style={{ fontFamily: 'JetBrains Mono', color: '#1366F0' }}>{total.toLocaleString('ru-RU')} Br</span>
      </div>
    </div>
  )
}

export default function FleetTripDetail({ tripId, onBack, onOpenOrder }) {
  const { show } = useToast()
  const [trip, setTrip] = useState(null)
  const [finance, setFinance] = useState(null)
  const [forward, setForward] = useState([])
  const [backward, setBackward] = useState([])
  const [showAddOrder, setShowAddOrder] = useState(null) // 'forward' | 'backward' | null
  const [editing, setEditing] = useState(false)

  const removeTrip = async () => {
    if (!window.confirm('Удалить весь рейс со всеми заказами?')) return
    try {
      await deleteFleetTrip(tripId)
      show('Рейс удалён', { type: 'info' })
      onBack()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const dupTrip = async () => {
    if (!window.confirm('Создать копию рейса со всеми заказами (без дат и оплат)?')) return
    try {
      const nt = await duplicateFleetTrip(tripId)
      show(`Создан рейс Р${nt.trip_number}`, { type: 'success' })
      onBack()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const load = useCallback(() => {
    return getFleetTrip(tripId)
      .then(r => { setTrip(r.trip); setFinance(r.finance || null); setForward(r.forward || []); setBackward(r.backward || []) })
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
  }, [tripId, show])

  useEffect(() => { load() }, [load])

  if (!trip) return <Loader padding={20} />

  const saveTripInfo = async (data) => {
    try {
      const updated = await updateFleetTrip(tripId, data)
      setTrip(t => ({ ...t, ...(updated || data) }))
      // финансовые поля пересчитывает бэкенд — подтягиваем свежие
      getFleetTrip(tripId).then(r => { setTrip(r.trip); setFinance(r.finance || null) }).catch(() => {})
      show('Сохранено', { type: 'success' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <PillBtn variant="neutral" icon="back" onClick={onBack}>Все рейсы</PillBtn>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 20, color: '#0E1726' }}>
            {trip.trip_number ? `Р${trip.trip_number} · ` : ''}{trip.name || 'Рейс'}
          </span>
          <span style={{ fontSize: 12, color: '#8A93A0', marginLeft: 10 }}>
            {(trip.route_from || '—')} → {(trip.route_to || '—')} · {(trip.total_amount || 0).toLocaleString('ru-RU')} Br
          </span>
        </div>
        <PillBtn variant="edit" icon="edit" onClick={() => setEditing(true)}>Изменить</PillBtn>
        <PillBtn variant="neutral" icon="dup" onClick={dupTrip}>Дублировать</PillBtn>
        <PillBtn variant="delete" icon="delete" onClick={removeTrip}>Удалить</PillBtn>
      </div>

      {/* Статус рейса */}
      <SlidingTabs
        options={TRIP_STATUS.map(s => ({ key: s.key, label: s.label }))}
        value={trip.status || 'active'}
        onChange={k => saveTripInfo({ status: k })}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <DirectionSection
          title={`Прямой: ${trip.route_from || '—'} → ${trip.route_to || '—'}`}
          orders={forward}
          onAdd={() => setShowAddOrder('forward')}
          onReload={load}
          onOpen={onOpenOrder}
        />
        <DirectionSection
          title={`Обратка: ${trip.route_to || '—'} → ${trip.route_from || '—'}`}
          orders={backward}
          onAdd={() => setShowAddOrder('backward')}
          onReload={load}
          onOpen={onOpenOrder}
        />
      </div>

      <TripInfoCard trip={trip} revenue={trip.total_amount || 0} finance={finance} onSave={saveTripInfo} onReload={load} />

      <CommentsCard entity="trips" id={tripId} comments={trip.comments} onReload={load} />

      {showAddOrder && (
        <FleetOrderModal
          tripId={tripId}
          direction={showAddOrder}
          trip={trip}
          onClose={() => setShowAddOrder(null)}
          onSaved={() => { setShowAddOrder(null); load() }}
        />
      )}

      {editing && (
        <EditTripModal
          trip={trip}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setEditing(false); setTrip(t => ({ ...t, ...updated })) }}
        />
      )}
    </div>
  )
}
