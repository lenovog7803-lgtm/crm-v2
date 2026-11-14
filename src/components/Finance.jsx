import { useState, useEffect } from 'react'
import { getOrders, getClients, getCarriers, getPaymentsIn, getPaymentsOut, createPaymentIn, createPaymentOut, deletePaymentIn, deletePaymentOut, generateReconciliation, getReconciliationHistory, getClientPPLedger, addClientPPEntry, deleteClientPPEntry, getCarrierPPLedger, addCarrierPPEntry, deleteCarrierPPEntry } from '../api'
import { fmtMoney, initials, getGradient, fmtDate, inPeriod } from '../utils'
import { useIsMobile } from '../hooks/useIsMobile'
import { SkeletonRow } from './Skeleton'
import { useToast } from './Toast'
import { SlidingTabs } from './SlidingTabs'
import { mouseOnly } from '../motion'
import Select from './Select'
import { EmptyState } from './EmptyState'
import DateInput from './DateInput'
import CardGradient from './CardGradient'

export default function Finance({ refreshKey, period = 'all' }) {
  const isMobile = useIsMobile()
  const { show } = useToast()
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [carriers, setCarriers] = useState([])
  const [paymentsIn, setPaymentsIn] = useState([])
  const [paymentsOut, setPaymentsOut] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [showInModal, setShowInModal] = useState(false)
  const [showOutModal, setShowOutModal] = useState(false)

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
  const [showLedger, setShowLedger] = useState(false)

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
      getOrders({ limit: 2000, light: true }).catch(() => []),
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
  }, [refreshKey])

  // История актов сверки скопирована к конкретному контрагенту — бэкенд
  // возвращает [] без counterparty_id, поэтому подгружаем при выборе.
  useEffect(() => {
    if (!recPartyId) { setRecHistory([]); return }
    getReconciliationHistory({ counterparty_id: recPartyId, type: recType }).then(r => setRecHistory(Array.isArray(r) ? r : (r?.history || []))).catch(() => {})
  }, [recPartyId, recType])

  // Hero totals — из заявок по флагам оплаты (client_paid / carrier_paid)
  const paidClientOrders = orders.filter(o => o.client_paid && !o.deleted)
  const paidCarrierOrders = orders.filter(o => o.carrier_paid && !o.deleted)
  // суммы сверху — за период из верхней панели (та же дата заявки, что на дашборде)
  const orderInPeriod = o => inPeriod(o.unload_date || o.load_date || o.created_at, period)
  const periodClientPaid = paidClientOrders.filter(orderInPeriod)
  const periodCarrierPaid = paidCarrierOrders.filter(orderInPeriod)
  const totalIncome = periodClientPaid.reduce((s, o) => s + parseFloat(o.client_rate || 0), 0)
  const totalExpense = periodCarrierPaid.reduce((s, o) => s + parseFloat(o.carrier_rate || 0), 0)
  const netProfit = totalIncome - totalExpense
  const marginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0

  // Manual payments table (with pp_number + date)
  const allPayments = [
    ...paymentsIn.map(p => ({ ...p, kind: 'income', name: p.client_name || '—', gradKey: p.client_name || '' })),
    ...paymentsOut.map(p => ({ ...p, kind: 'expense', name: p.carrier_name || '—', gradKey: p.carrier_name || '' })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  let filtered = allPayments.filter(p => inPeriod(p.date, period))
  if (typeFilter === 'income') filtered = filtered.filter(p => p.kind === 'income')
  if (typeFilter === 'expense') filtered = filtered.filter(p => p.kind === 'expense')

  const PREVIEW = 5
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW)

  // Reconciliation
  const actClientNames = [...new Set(paidClientOrders.map(o => o.client_name).filter(Boolean))]
  const actCarrierNames = [...new Set(paidCarrierOrders.map(o => o.carrier_name).filter(Boolean))]
  const actNames = actPartyType === 'clients' ? actClientNames : actCarrierNames
  const actOrders = actParty
    ? (actPartyType === 'clients'
        ? paidClientOrders.filter(o => o.client_name === actParty)
        : paidCarrierOrders.filter(o => o.carrier_name === actParty))
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
      const result = await generateReconciliation({ type: recType, counterparty_id: recPartyId, counterparty_name: recPartyName, period: recPeriod })
      if (result?.doc_error) show('Акт сформирован без документа: ' + result.doc_error, { type: 'error' })
      else if (result?.url) { window.open(result.url, '_blank'); show(`Акт сформирован: ${result.counterparty_name || recPartyName}`, { type: 'success' }) }
      getReconciliationHistory({ counterparty_id: recPartyId, type: recType }).then(r => setRecHistory(Array.isArray(r) ? r : (r?.history || []))).catch(() => {})
    } catch (e) { console.error(e); show('Ошибка: ' + e.message, { type: 'error' }) }
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
  const iStyle = { height: 36, padding: '0 10px', fontSize: 13, borderRadius: 10, border: '1px solid rgba(var(--ink-rgb), 0.14)', background: 'rgba(var(--paper-rgb), 0.8)', fontFamily: 'var(--font-sys)', color: 'var(--ink)', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16 }}>

      {/* Summary — 3 равных колонки на десктопе */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="grad-card grad-blue" style={{ padding: '18px 18px', color: '#fff' }}>
            <CardGradient tone="blue" />
            <div className="grad-kicker">Чистая прибыль</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1 }}>{netProfit.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>BYN</div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,calc(0.25 * var(--rim-k)))' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>Поступления</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{totalIncome.toLocaleString('ru-RU')} BYN</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>Списания</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{totalExpense.toLocaleString('ru-RU')} BYN</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
            <div onClick={() => setShowInModal(true)} className="ios-widget" style={{ cursor: 'pointer', padding: '14px 14px', color: 'var(--ink)' }}>
              <div className="grad-kicker" style={{ color: 'var(--fg-1e9e5a)' }}>Поступления</div>
              <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>{totalIncome.toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>BYN</div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{periodClientPaid.length} заявок оплачено</div>
            </div>
            <div onClick={() => setShowOutModal(true)} className="ios-widget" style={{ cursor: 'pointer', padding: '14px 14px', color: 'var(--ink)' }}>
              <div className="grad-kicker" style={{ color: 'var(--fg-7c3aed)' }}>Списания</div>
              <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>{totalExpense.toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>BYN</div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{periodCarrierPaid.length} заявок оплачено</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16 }}>
          <div className="grad-card grad-blue" style={{ padding: '26px 28px', color: '#fff' }}>
            <CardGradient tone="blue" />
            <div className="grad-kicker">Чистая прибыль</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1 }}>{netProfit.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>BYN</div>
            <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,calc(0.25 * var(--rim-k)))' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>Поступления</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{totalIncome.toLocaleString('ru-RU')} BYN</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>Списания</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{totalExpense.toLocaleString('ru-RU')} BYN</div>
              </div>
            </div>
          </div>
          <div onClick={() => setShowInModal(true)} className="ios-widget" style={{ cursor: 'pointer', padding: '26px 24px', color: 'var(--ink)' }}>
            <div className="grad-kicker" style={{ color: 'var(--fg-1e9e5a)' }}>Поступления</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalIncome.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>BYN</div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{periodClientPaid.length} заявок оплачено</div>
          </div>
          <div onClick={() => setShowOutModal(true)} className="ios-widget" style={{ cursor: 'pointer', padding: '26px 24px', color: 'var(--ink)' }}>
            <div className="grad-kicker" style={{ color: 'var(--fg-7c3aed)' }}>Списания</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalExpense.toLocaleString('ru-RU')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>BYN</div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{periodCarrierPaid.length} заявок оплачено</div>
          </div>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(3,1fr)', gap: isMobile ? 8 : 12 }}>
        {[
          { label: 'Выручка', val: fmtMoney(totalIncome), color: 'var(--fg-1e9e5a)' },
          { label: 'Перевозчики', val: fmtMoney(totalExpense), color: 'var(--fg-1366f0)' },
          { label: 'Маржа', val: marginPct + '%', color: 'var(--fg-d97706)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: isMobile ? '10px 12px' : '16px 18px' }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: isMobile ? 4 : 6 }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: isMobile ? 14 : 18, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Payments — ручные записи с ПП и датой */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: showAdd ? 12 : 14, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', flex: 1 }}>Платежи</div>
          <SlidingTabs
            options={[{ key: 'all', label: 'Все' }, { key: 'income', label: 'Поступления' }, { key: 'expense', label: 'Списания' }]}
            value={typeFilter}
            onChange={k => { setTypeFilter(k); setShowAll(false) }}
          />
          <button onClick={() => setShowAdd(v => !v)} className="btn-icon" style={{ width: 32, height: 32, background: showAdd ? 'rgba(var(--rgb-200-25-35), 0.1)' : 'rgba(var(--rgb-19-102-240), 0.12)', color: showAdd ? 'var(--fg-c81923)' : 'var(--fg-1366f0)' }}>
            {showAdd
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            }
          </button>
        </div>

        {/* Форма добавления платежа */}
        {showAdd && (
          <form onSubmit={handleAddPayment} style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'rgba(var(--ink-rgb), 0.03)', border: '1px solid rgba(var(--ink-rgb), 0.07)' }}>
            {/* Тип */}
            <div style={{ marginBottom: 12 }}>
              <SlidingTabs
                options={[{ key: 'income', label: 'Поступление' }, { key: 'expense', label: 'Списание' }]}
                value={addType}
                onChange={k => { setAddType(k); setAddPartyId('') }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
              {/* Контрагент */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 5 }}>{addType === 'income' ? 'Клиент' : 'Перевозчик'}</div>
                <Select value={addPartyId} onChange={e => setAddPartyId(e.target.value)} required style={{ ...iStyle, width: '100%' }}>
                  <option value="">— Выберите —</option>
                  {(addType === 'income' ? clients : carriers).map(x => (
                    <option key={x.id} value={x.id}>{addType === 'income' ? x.name : x.company_name}</option>
                  ))}
                </Select>
              </div>
              {/* ПП */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2b)', paddingLeft: 4, marginBottom: 5 }}>№ ПП</div>
                <input value={addPP} onChange={e => setAddPP(e.target.value)} required placeholder="12345" style={{ ...iStyle, width: '100%' }} />
              </div>
              {/* Дата */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2b)', paddingLeft: 4, marginBottom: 5 }}>Дата</div>
                <DateInput type="date" value={addDate} onChange={e => setAddDate(e.target.value)} required style={{ ...iStyle, width: '100%' }} />
              </div>
              {/* Сумма */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2b)', paddingLeft: 4, marginBottom: 5 }}>Сумма (BYN)</div>
                <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} required placeholder="0.00" step="0.01" style={{ ...iStyle, width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="submit" disabled={addLoading} className="btn-primary">{addLoading ? 'Сохранение...' : 'Добавить платёж'}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">Отмена</button>
            </div>
          </form>
        )}

        {loading && (
          <div>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {visible.map((p, i) => {
            const [avA, avB] = getGradient(p.gradKey)
            return (
              <div key={`${p.kind}-${p.id}`}
                onPointerEnter={mouseOnly(e => e.currentTarget.style.background = 'rgba(var(--rgb-19-102-240), 0.05)')}
                onPointerLeave={mouseOnly(e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(var(--ink-rgb), 0.02)' : 'transparent')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 12,
                  background: i % 2 === 0 ? 'rgba(var(--ink-rgb), 0.02)' : 'transparent',
                  transition: 'background 0.15s var(--ease)',
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  '--av-hue': avB, background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>{initials(p.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {p.kind === 'income' ? 'Поступление' : 'Списание'}
                    {p.pp_number ? ` · ПП ${p.pp_number}` : ''}
                    {p.order_number ? <span style={{ color: 'var(--fg-1366f0)', fontFamily: 'var(--font-mono)' }}> · {p.order_number}</span> : ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtDate(p.date) || '—'}</div>
                <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: p.kind === 'income' ? 'var(--fg-1e9e5a)' : 'var(--fg-1366f0)', flexShrink: 0 }}>
                  {p.kind === 'income' ? '+' : '-'}{(p.amount || 0).toLocaleString('ru-RU')} BYN
                </div>
                <button onClick={() => handleDeletePayment(p)} className="btn-icon" style={{ width: 28, height: 28, background: 'rgba(var(--rgb-200-25-35), 0.07)', color: 'var(--fg-c81923)', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </div>
            )
          })}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Нет платежей</div>
          )}
        </div>
        {filtered.length > PREVIEW && (
          <button onClick={() => setShowAll(v => !v)} className="btn-ghost" style={{ width: '100%', marginTop: 10, color: 'var(--fg-1366f0)', justifyContent: 'center' }}>{showAll ? 'Свернуть' : `Показать все (${filtered.length})`}</button>
        )}
      </div>

      {/* Акт сверки — таблица */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 14 }}>Акт сверки</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <SlidingTabs
            options={[{ key: 'clients', label: 'Клиенты' }, { key: 'carriers', label: 'Перевозчики' }]}
            value={actPartyType}
            onChange={k => { setActPartyType(k); setActParty('') }}
          />
          <Select value={actParty} onChange={e => setActParty(e.target.value)} style={{ ...iStyle, minWidth: 200 }}>
            <option value="">— Выберите контрагента —</option>
            {actNames.map(n => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        {actRows.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(var(--ink-rgb), 0.08)' }}>
                {['№', 'Заявка', 'Дата выгрузки', 'Сумма', 'Сальдо'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, letterSpacing: 0, color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid rgba(var(--ink-rgb), 0.04)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{row.n}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-1366f0)' }}>{row.order_number || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtDate(row.unload_date) || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-1e9e5a)', fontWeight: 700 }}>{(row.amt || 0).toLocaleString('ru-RU')} BYN</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: row.balance >= 0 ? 'var(--fg-1e9e5a)' : 'var(--fg-c81923)' }}>{row.balance.toLocaleString('ru-RU')} BYN</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Выберите контрагента для формирования акта сверки
          </div>
        )}
      </div>

      {/* Генерация акта сверки */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 14 }}>Сформировать акт сверки (документ)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Тип</label>
            <Select value={recType} onChange={e => { setRecType(e.target.value); setRecPartyId(''); setRecPartyName('') }} style={iStyle}>
              <option value="client">Клиент</option>
              <option value="carrier">Перевозчик</option>
            </Select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{recType === 'client' ? 'Клиент' : 'Перевозчик'}</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <PartySearchSelect
                items={recList}
                labelKey={recLabelKey}
                value={recPartyId}
                onChange={(id, name) => { setRecPartyId(id); setRecPartyName(name) }}
                placeholder={`Поиск: ${recType === 'client' ? 'клиент' : 'перевозчик'}...`}
              />
              {recPartyId && (
                <button onClick={() => setShowLedger(true)} className="btn-icon" style={{ width: 26, height: 26, color: 'var(--fg-1366f0)', fontSize: 15, fontWeight: 700, marginLeft: 8 }} title={`Список платежей ${recType === 'client' ? 'клиента' : 'перевозчику'} для акта сверки`}>
                  +
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Период</label>
            <Select value={recPeriod} onChange={e => setRecPeriod(e.target.value)} style={iStyle}>
              <option value="month">Этот месяц</option>
              <option value="last_month">Прошлый месяц</option>
              <option value="quarter">Квартал</option>
              <option value="year">Год</option>
              <option value="all">Всё время</option>
            </Select>
          </div>
          <button onClick={handleGenerateReconciliation} disabled={recLoading || !recPartyId} className="btn-primary" style={{ height: 36, opacity: recLoading ? 0.7 : 1 }}>{recLoading ? 'Генерация...' : 'Сформировать акт'}</button>
        </div>
        {recHistory.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>История</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {recHistory.slice(0, 5).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.date || r.created_at)}</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{r.counterparty_name || r.counterparty_id}</span>
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-1366f0)', fontWeight: 600, textDecoration: 'none' }}>Открыть</a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Модалка — детали поступлений */}
      {showInModal && (
        <div className="dash-modal-scrim">
          <div className="dash-modal dash-form" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>Поступления от клиентов</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Итого: {totalIncome.toLocaleString('ru-RU')} BYN · {periodClientPaid.length} заявок</div>
                </div>
                <button onClick={() => setShowInModal(false)} className="btn-icon" style={{ width: 32, height: 32, fontSize: 17 }}>×</button>
              </div>
              {periodClientPaid.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>Нет оплаченных заявок</div>
              ) : periodClientPaid.map((o, i) => {
                const [avA, avB] = getGradient(o.client_name || '')
                return (
                  <div key={o.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(var(--ink-rgb), 0.06)' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      '--av-hue': avB, background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700,
                    }}>{initials(o.client_name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{o.client_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {o.order_number} · {o.route_from} → {o.route_to}
                        {o.client_paid_date ? ` · ${new Date(o.client_paid_date).toLocaleDateString('ru-RU')}` : ''}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--fg-1e9e5a)', flexShrink: 0 }}>
                      +{parseFloat(o.client_rate || 0).toLocaleString('ru-RU')} BYN
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Модалка — детали списаний */}
      {showOutModal && (
        <div className="dash-modal-scrim">
          <div className="dash-modal dash-form" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>Оплачено перевозчикам</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-e0473b)', fontWeight: 600, marginTop: 2 }}>Итого: -{totalExpense.toLocaleString('ru-RU')} BYN · {periodCarrierPaid.length} заявок</div>
                </div>
                <button onClick={() => setShowOutModal(false)} className="btn-icon" style={{ width: 32, height: 32, fontSize: 17 }}>×</button>
              </div>
              {periodCarrierPaid.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>Нет оплаченных заявок</div>
              ) : periodCarrierPaid.map((o, i) => {
                const [avA, avB] = getGradient(o.carrier_name || '')
                return (
                  <div key={o.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid rgba(var(--ink-rgb), 0.06)', borderLeft: '3px solid rgba(var(--rgb-224-71-59), 0.35)', background: 'rgba(var(--rgb-224-71-59), 0.03)' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      '--av-hue': avB, background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700,
                    }}>{initials(o.carrier_name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{o.carrier_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {o.order_number} · {o.route_from} → {o.route_to}
                        {o.carrier_paid_date ? ` · ${new Date(o.carrier_paid_date).toLocaleDateString('ru-RU')}` : ''}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--fg-e0473b)', flexShrink: 0 }}>
                      -{parseFloat(o.carrier_rate || 0).toLocaleString('ru-RU')} BYN
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Журнал платежей клиента/перевозчику для акта сверки */}
      {showLedger && (
        <PPLedgerModal
          type={recType}
          entityId={recPartyId}
          entityName={recPartyName}
          onClose={() => setShowLedger(false)}
        />
      )}
    </div>
  )
}

// Комбобокс с поиском по названию — обычный <select> неудобен, когда
// перевозчиков/клиентов в списке сотни.
function PartySearchSelect({ items, labelKey, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = items.find(i => i.id === value)
  const q = query.trim().toLowerCase()
  const filtered = q ? items.filter(i => (i[labelKey] || i.name || '').toLowerCase().includes(q)) : items

  return (
    <div style={{ position: 'relative', minWidth: 200, flex: 1 }}>
      <input
        value={open ? query : (selected ? (selected[labelKey] || selected.name || '') : '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={{ height: 36, padding: '0 10px', fontSize: 13, borderRadius: 10, border: '1px solid rgba(var(--ink-rgb), 0.14)', background: 'rgba(var(--paper-rgb), 0.8)', fontFamily: 'var(--font-sys)', color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
      {open && (
        <div className="glass-pop" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', zIndex: 20 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-3)' }}>Ничего не найдено</div>
          ) : filtered.slice(0, 200).map(item => (
            <div
              key={item.id}
              onMouseDown={() => { onChange(item.id, item[labelKey] || item.name || ''); setOpen(false); setQuery('') }}
              className="glass-pop-item"
              style={{ padding: '8px 12px', fontSize: 13, color: 'var(--ink)' }}
            >
              {item[labelKey] || item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PPLedgerModal({ type, entityId, entityName, onClose }) {
  const [entries, setEntries] = useState([])
  const [ppNumber, setPpNumber] = useState('')
  const [ppDate, setPpDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const { show } = useToast()

  const getLedger = type === 'client' ? getClientPPLedger : getCarrierPPLedger
  const addEntry = type === 'client' ? addClientPPEntry : addCarrierPPEntry
  const deleteEntry = type === 'client' ? deleteClientPPEntry : deleteCarrierPPEntry
  const accentColor = type === 'client' ? 'var(--fg-1e9e5a)' : 'var(--fg-e0473b)'

  const load = () => getLedger(entityId).then(r => setEntries(r.entries || []))
  useEffect(() => { load() }, [entityId, type])

  const total = entries.reduce((s, e) => s + Number(e.amount || 0), 0)

  const add = async () => {
    if (!ppNumber.trim() || !ppDate || !amount) {
      show('Заполните номер ПП, дату и сумму', { type: 'error' })
      return
    }
    await addEntry(entityId, {
      pp_number: ppNumber.trim(), pp_date: ppDate, amount: Number(amount),
    })
    setPpNumber(''); setAmount('')
    load()
  }

  const remove = async (id) => {
    await deleteEntry(entityId, id)
    load()
  }

  return (
    <div onClick={onClose} className="dash-modal-scrim">
      <div onClick={e => e.stopPropagation()} className="dash-modal dash-form" style={{ maxWidth: 520, padding: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{type === 'client' ? 'Платежи клиента' : 'Платежи перевозчику'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{entityName} · всего {total.toLocaleString('ru-RU')} Br</div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32, fontSize: 17 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={ppNumber} onChange={e => setPpNumber(e.target.value)} placeholder="№ ПП" style={{ width: 90, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 12 }} />
          <DateInput type="date" value={ppDate} onChange={e => setPpDate(e.target.value)} style={{ width: 130, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 12 }} />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Сумма" style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 12 }} />
          <button onClick={add} className="btn-icon" style={{ width: 34, height: 34, background: 'var(--bg-1366f0)', color: '#fff', fontSize: 17 }}>+</button>
        </div>

        <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <EmptyState compact title="Платежей пока нет" subtitle="Платежи появятся, когда вы отметите оплату в заявке" />
          ) : entries.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--fill-2)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>ПП № {e.pp_number}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(e.pp_date).toLocaleDateString('ru-RU')}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: accentColor }}>
                {Number(e.amount).toLocaleString('ru-RU')} Br
              </div>
              <button onClick={() => remove(e.id)} className="btn-bare" style={{ color: 'var(--fg-e0473b)', fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
