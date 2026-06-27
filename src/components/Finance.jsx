import { useState, useEffect } from 'react'
import { getOrders, getClients, getCarriers, getPaymentsIn, getPaymentsOut, createPaymentIn, createPaymentOut, deletePaymentIn, deletePaymentOut, generateReconciliation, getReconciliationHistory } from '../api'
import { fmtMoney, initials, getGradient } from '../utils'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Finance({ refreshKey }) {
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [carriers, setCarriers] = useState([])
  const [paymentsIn, setPaymentsIn] = useState([])
  const [paymentsOut, setPaymentsOut] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)

  // Add payment modal state
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState('income')
  const [addPartyId, setAddPartyId] = useState('')
  const [addPP, setAddPP] = useState('')
  const [addDate, setAddDate] = useState(new Date().toISOString().slice(0, 10))
  const [addAmount, setAddAmount] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Reconciliation state
  const [actPartyType, setActPartyType] = useState('clients')
  const [actParty, setActParty] = useState('')
  const [recType, setRecType] = useState('client')
  const [recPartyId, setRecPartyId] = useState('')
  const [recPartyName, setRecPartyName] = useState('')
  const [recPeriod, setRecPeriod] = useState('month')
  const [recLoading, setRecLoading] = useState(false)
  const [recHistory, setRecHistory] = useState([])

  const loadPayments = () => Promise.all([
    getPaymentsIn().catch(() => []),
    getPaymentsOut().catch(() => []),
  ]).then(([ins, outs]) => {
    setPaymentsIn(Array.isArray(ins) ? ins : [])
    setPaymentsOut(Array.isArray(outs) ? outs : [])
  })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getOrders({ limit: 2000 }).catch(() => []),
      getClients().catch(() => []),
      getCarriers().catch(() => []),
      getPaymentsIn().catch(() => []),
      getPaymentsOut().catch(() => []),
    ]).then(([ords, cls, cars, ins, outs]) => {
      setOrders(Array.isArray(ords) ? ords : [])
      setClients(Array.isArray(cls) ? cls : [])
      setCarriers(Array.isArray(cars) ? cars : [])
      setPaymentsIn(Array.isArray(ins) ? ins : [])
      setPaymentsOut(Array.isArray(outs) ? outs : [])
    }).finally(() => setLoading(false))
    getReconciliationHistory({}).then(r => setRecHistory(Array.isArray(r) ? r : (r?.history || []))).catch(() => {})
  }, [refreshKey])

  // Hero totals — from orders (paid flags)
  const receipts = orders.filter(o => o.client_paid)
  const expenses = orders.filter(o => o.carrier_paid)
  const totalIncome = receipts.reduce((s, o) => s + (o.client_rate || 0), 0)
  const totalExpense = expenses.reduce((s, o) => s + (o.carrier_rate || 0), 0)
  const netProfit = totalIncome - totalExpense
  const marginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0

  // Manual payments table (with pp_number + date)
  const allPayments = [
    ...paymentsIn.map(p => ({ ...p, kind: 'income', name: p.client_name || '—', gradKey: p.client_name || '' })),
    ...paymentsOut.map(p => ({ ...p, kind: 'expense', name: p.carrier_name || '—', gradKey: p.carrier_name || '' })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  let filtered = [...allPayments]
  if (typeFilter === 'income') filtered = filtered.filter(p => p.kind === 'income')
  if (typeFilter === 'expense') filtered = filtered.filter(p => p.kind === 'expense')

  const PREVIEW = 15
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW)

  // Reconciliation
  const actClientNames = [...new Set(receipts.map(o => o.client_name).filter(Boolean))]
  const actCarrierNames = [...new Set(expenses.map(o => o.carrier_name).filter(Boolean))]
  const actNames = actPartyType === 'clients' ? actClientNames : actCarrierNames
  const actOrders = actParty
    ? (actPartyType === 'clients'
        ? receipts.filter(o => o.client_name === actParty)
        : expenses.filter(o => o.carrier_name === actParty))
    : []

  let balance = 0
  const actRows = actOrders.map((o, i) => {
    const amt = actPartyType === 'clients' ? (o.client_rate || 0) : (o.carrier_rate || 0)
    balance += actPartyType === 'clients' ? amt : -amt
    return { ...o, amt, balance, n: i + 1 }
  })

  const handleGenerateReconciliation = async () => {
    if (!recPartyId) return
    setRecLoading(true)
    try {
      const result = await generateReconciliation({ type: recType, counterparty_id: recPartyId, period: recPeriod })
      if (result?.url) window.open(result.url, '_blank')
      getReconciliationHistory({}).then(r => setRecHistory(Array.isArray(r) ? r : (r?.history || []))).catch(() => {})
    } catch (e) { console.error(e) }
    setRecLoading(false)
  }

  const handleAddPayment = async e => {
    e.preventDefault()
    if (!addPP || !addDate || !addAmount || !addPartyId) return
    setAddLoading(true)
    try {
      const party = addType === 'income'
        ? clients.find(c => c.id === addPartyId)
        : carriers.find(c => c.id === addPartyId)
      const payload = {
        pp_number: addPP,
        date: addDate,
        amount: parseFloat(addAmount),
        notes: addNotes,
        ...(addType === 'income'
          ? { client_id: addPartyId, client_name: party?.name || '' }
          : { carrier_id: addPartyId, carrier_name: party?.company_name || '' }),
      }
      if (addType === 'income') await createPaymentIn(payload)
      else await createPaymentOut(payload)
      await loadPayments()
      setShowAdd(false)
      setAddPP(''); setAddAmount(''); setAddNotes(''); setAddPartyId('')
    } catch (err) { console.error(err) }
    setAddLoading(false)
  }

  const handleDeletePayment = async (p) => {
    try {
      if (p.kind === 'income') await deletePaymentIn(p.id)
      else await deletePaymentOut(p.id)
      await loadPayments()
    } catch (err) { console.error(err) }
  }

  const recList = recType === 'client' ? clients : carriers
  const recLabelKey = recType === 'client' ? 'name' : 'company_name'
  const iStyle = { height: 36, padding: '0 10px', fontSize: 13, borderRadius: 10, border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)', fontFamily: 'Manrope', color: '#0E1726', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16 }}>

      {/* Summary — 3 равных колонки на десктопе */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)', borderRadius: 22, padding: '18px 18px', color: '#fff', boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>ЧИСТАЯ ПРИБЫЛЬ</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1 }}>{netProfit.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>BYN</div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Поступления</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{totalIncome.toLocaleString('ru-RU')} BYN</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Списания</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{totalExpense.toLocaleString('ru-RU')} BYN</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #1E9E5A 0%, #15734A 100%)', borderRadius: 22, padding: '14px 14px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(30,158,90,0.4)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>ПОСТУПЛЕНИЯ</div>
              <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>{totalIncome.toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{receipts.length} оплачено</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #1366F0 0%, #0D4FB5 100%)', borderRadius: 22, padding: '14px 14px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(19,102,240,0.4)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>СПИСАНИЯ</div>
              <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>{totalExpense.toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{expenses.length} оплачено</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16 }}>
          <div style={{ background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)', borderRadius: 22, padding: '26px 28px', color: '#fff', boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>ЧИСТАЯ ПРИБЫЛЬ</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1 }}>{netProfit.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>BYN</div>
            <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Поступления</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{totalIncome.toLocaleString('ru-RU')} BYN</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Списания</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{totalExpense.toLocaleString('ru-RU')} BYN</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #1E9E5A 0%, #15734A 100%)', borderRadius: 22, padding: '26px 24px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(30,158,90,0.4)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>ПОСТУПЛЕНИЯ</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalIncome.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
            <div style={{ marginTop: 14, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{receipts.length} оплачено</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #1366F0 0%, #0D4FB5 100%)', borderRadius: 22, padding: '26px 24px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(19,102,240,0.4)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>СПИСАНИЯ</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalExpense.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
            <div style={{ marginTop: 14, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{expenses.length} оплачено</div>
          </div>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(3,1fr)', gap: isMobile ? 8 : 12 }}>
        {[
          { label: 'Выручка', val: fmtMoney(totalIncome), color: '#1E9E5A' },
          { label: 'Перевозчики', val: fmtMoney(totalExpense), color: '#1366F0' },
          { label: 'Маржа', val: marginPct + '%', color: '#D97706' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: isMobile ? '10px 12px' : '16px 18px' }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: '#A6AEB8', fontWeight: 600, marginBottom: isMobile ? 4 : 6 }}>{k.label}</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: isMobile ? 14 : 18, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Payments — ручные записи с ПП и датой */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: showAdd ? 12 : 14, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', flex: 1 }}>Платежи</div>
          {[{ k: 'all', l: 'Все' }, { k: 'income', l: 'Поступления' }, { k: 'expense', l: 'Списания' }].map(f => (
            <button key={f.k} onClick={() => { setTypeFilter(f.k); setShowAll(false) }} style={{
              padding: '5px 13px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
              background: typeFilter === f.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
              color: typeFilter === f.k ? '#fff' : '#5A6573',
            }}>{f.l}</button>
          ))}
          <button onClick={() => setShowAdd(v => !v)} style={{
            width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: showAdd ? 'rgba(200,25,35,0.1)' : 'rgba(19,102,240,0.12)',
            color: showAdd ? '#C81923' : '#1366F0',
          }}>
            {showAdd
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            }
          </button>
        </div>

        {/* Форма добавления платежа */}
        {showAdd && (
          <form onSubmit={handleAddPayment} style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'rgba(14,23,38,0.03)', border: '1px solid rgba(14,23,38,0.07)' }}>
            {/* Тип */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[{ k: 'income', l: 'Поступление' }, { k: 'expense', l: 'Списание' }].map(t => (
                <button type="button" key={t.k} onClick={() => { setAddType(t.k); setAddPartyId('') }} style={{
                  padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
                  background: addType === t.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
                  color: addType === t.k ? '#fff' : '#5A6573',
                }}>{t.l}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
              {/* Контрагент */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#A6AEB8', letterSpacing: '0.08em', marginBottom: 5 }}>{addType === 'income' ? 'КЛИЕНТ' : 'ПЕРЕВОЗЧИК'}</div>
                <select value={addPartyId} onChange={e => setAddPartyId(e.target.value)} required style={{ ...iStyle, width: '100%' }}>
                  <option value="">— Выберите —</option>
                  {(addType === 'income' ? clients : carriers).map(x => (
                    <option key={x.id} value={x.id}>{addType === 'income' ? x.name : x.company_name}</option>
                  ))}
                </select>
              </div>
              {/* ПП */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#A6AEB8', letterSpacing: '0.08em', marginBottom: 5 }}>№ ПП</div>
                <input value={addPP} onChange={e => setAddPP(e.target.value)} required placeholder="12345" style={{ ...iStyle, width: '100%' }} />
              </div>
              {/* Дата */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#A6AEB8', letterSpacing: '0.08em', marginBottom: 5 }}>ДАТА</div>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} required style={{ ...iStyle, width: '100%' }} />
              </div>
              {/* Сумма */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#A6AEB8', letterSpacing: '0.08em', marginBottom: 5 }}>СУММА (BYN)</div>
                <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} required placeholder="0.00" step="0.01" style={{ ...iStyle, width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="submit" disabled={addLoading} style={{
                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#0E1726', color: '#fff',
                fontFamily: 'Manrope', fontSize: 13, fontWeight: 600,
              }}>{addLoading ? 'Сохранение...' : 'Добавить платёж'}</button>
              <button type="button" onClick={() => setShowAdd(false)} style={{
                padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(14,23,38,0.12)', cursor: 'pointer',
                background: 'transparent', color: '#5A6573', fontFamily: 'Manrope', fontSize: 13,
              }}>Отмена</button>
            </div>
          </form>
        )}

        {loading && <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {visible.map((p, i) => {
            const [avA, avB] = getGradient(p.gradKey)
            return (
              <div key={`${p.kind}-${p.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 11,
                background: i % 2 === 0 ? 'rgba(14,23,38,0.02)' : 'transparent',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>{initials(p.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 1 }}>
                    {p.kind === 'income' ? 'Поступление' : 'Списание'}
                    {p.pp_number ? ` · ПП ${p.pp_number}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#A6AEB8', flexShrink: 0 }}>{p.date || '—'}</div>
                <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: p.kind === 'income' ? '#1E9E5A' : '#1366F0', flexShrink: 0 }}>
                  {p.kind === 'income' ? '+' : '-'}{(p.amount || 0).toLocaleString('ru-RU')} BYN
                </div>
                <button onClick={() => handleDeletePayment(p)} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.07)', color: '#C81923',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </div>
            )
          })}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', color: '#A6AEB8', fontSize: 14 }}>Нет платежей</div>
          )}
        </div>
        {filtered.length > PREVIEW && (
          <button onClick={() => setShowAll(v => !v)} style={{
            width: '100%', marginTop: 10, padding: '9px', borderRadius: 11,
            border: '1px solid rgba(19,102,240,0.2)', background: 'rgba(19,102,240,0.04)',
            cursor: 'pointer', fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, color: '#1366F0',
          }}>{showAll ? 'Свернуть' : `Показать все (${filtered.length})`}</button>
        )}
      </div>

      {/* Акт сверки — таблица */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Акт сверки</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ k: 'clients', l: 'Клиенты' }, { k: 'carriers', l: 'Перевозчики' }].map(f => (
              <button key={f.k} onClick={() => { setActPartyType(f.k); setActParty('') }} style={{
                padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
                background: actPartyType === f.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
                color: actPartyType === f.k ? '#fff' : '#5A6573',
              }}>{f.l}</button>
            ))}
          </div>
          <select value={actParty} onChange={e => setActParty(e.target.value)} style={{ ...iStyle, minWidth: 200 }}>
            <option value="">— Выберите контрагента —</option>
            {actNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {actRows.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(14,23,38,0.08)' }}>
                {['№', 'Заявка', 'Дата выгрузки', 'Сумма', 'Сальдо'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid rgba(14,23,38,0.04)' }}>
                  <td style={{ padding: '10px 12px', color: '#A6AEB8' }}>{row.n}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1366F0' }}>{row.order_number || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#5A6573' }}>{row.unload_date || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#1E9E5A', fontWeight: 700 }}>{(row.amt || 0).toLocaleString('ru-RU')} BYN</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: row.balance >= 0 ? '#1E9E5A' : '#C81923' }}>{row.balance.toLocaleString('ru-RU')} BYN</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>
            Выберите контрагента для формирования акта сверки
          </div>
        )}
      </div>

      {/* Генерация акта сверки */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Сформировать акт сверки (документ)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#A6AEB8' }}>Тип</label>
            <select value={recType} onChange={e => { setRecType(e.target.value); setRecPartyId(''); setRecPartyName('') }} style={iStyle}>
              <option value="client">Клиент</option>
              <option value="carrier">Перевозчик</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#A6AEB8' }}>{recType === 'client' ? 'Клиент' : 'Перевозчик'}</label>
            <select
              value={recPartyId}
              onChange={e => {
                const id = e.target.value
                const item = recList.find(x => x.id === id)
                setRecPartyId(id)
                setRecPartyName(item ? (item[recLabelKey] || item.name || '') : '')
              }}
              style={{ ...iStyle, minWidth: 200 }}
            >
              <option value="">— Выберите —</option>
              {recList.map(item => (
                <option key={item.id} value={item.id}>{item[recLabelKey] || item.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#A6AEB8' }}>Период</label>
            <select value={recPeriod} onChange={e => setRecPeriod(e.target.value)} style={iStyle}>
              <option value="month">Этот месяц</option>
              <option value="last_month">Прошлый месяц</option>
              <option value="quarter">Квартал</option>
              <option value="year">Год</option>
              <option value="all">Всё время</option>
            </select>
          </div>
          <button onClick={handleGenerateReconciliation} disabled={recLoading || !recPartyId} style={{
            height: 36, padding: '0 20px', borderRadius: 11, border: 'none',
            cursor: recPartyId ? 'pointer' : 'not-allowed',
            background: recPartyId ? '#1366F0' : 'rgba(14,23,38,0.08)',
            color: recPartyId ? '#fff' : '#A6AEB8',
            fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, opacity: recLoading ? 0.7 : 1,
          }}>{recLoading ? 'Генерация...' : 'Сформировать акт'}</button>
        </div>
        {recHistory.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A6AEB8', letterSpacing: '0.08em', marginBottom: 8 }}>ИСТОРИЯ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {recHistory.slice(0, 5).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                  <span style={{ color: '#5A6573' }}>{r.date || r.created_at?.slice(0, 10)}</span>
                  <span style={{ fontWeight: 600, color: '#0E1726', flex: 1 }}>{r.counterparty_name || r.counterparty_id}</span>
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1366F0', fontWeight: 600, textDecoration: 'none' }}>Открыть</a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
