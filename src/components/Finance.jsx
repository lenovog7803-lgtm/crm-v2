import { useState, useEffect } from 'react'
import { getPaymentsIn, getPaymentsOut, deletePaymentIn, deletePaymentOut, generateReconciliation, getReconciliationHistory } from '../api'
import { fmtMoney, initials, getGradient } from '../utils'

export default function Finance({ onAddPayment, refreshKey }) {
  const [paymentsIn, setPaymentsIn] = useState([])
  const [paymentsOut, setPaymentsOut] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAllIn, setShowAllIn] = useState(false)
  const [showAllOut, setShowAllOut] = useState(false)

  // Act sverki
  const [actPartyType, setActPartyType] = useState('clients')
  const [actParty, setActParty] = useState('')

  // Reconciliation form
  const [recType, setRecType] = useState('client')
  const [recPartyId, setRecPartyId] = useState('')
  const [recPeriod, setRecPeriod] = useState('month')
  const [recLoading, setRecLoading] = useState(false)
  const [recHistory, setRecHistory] = useState([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPaymentsIn().catch(() => []),
      getPaymentsOut().catch(() => []),
    ]).then(([ins, outs]) => {
      setPaymentsIn(Array.isArray(ins) ? ins : [])
      setPaymentsOut(Array.isArray(outs) ? outs : [])
    }).finally(() => setLoading(false))
  }, [refreshKey])

  useEffect(() => {
    getReconciliationHistory({}).then(r => setRecHistory(Array.isArray(r) ? r : (r?.history || []))).catch(() => {})
  }, [])

  const totalIncome = paymentsIn.reduce((s, p) => s + (p.amount || 0), 0)
  const totalExpense = paymentsOut.reduce((s, p) => s + (p.amount || 0), 0)
  const netProfit = totalIncome - totalExpense
  const taxReserve = Math.round(totalIncome * 0.06)
  const cash = netProfit - taxReserve
  const marginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0

  const allPayments = [
    ...paymentsIn.map(p => ({ id: p.id, _type: 'in', kind: 'income', name: p.client_name || 'Клиент', pp: p.pp_number, date: p.date, amount: p.amount || 0, gradKey: p.client_name || '' })),
    ...paymentsOut.map(p => ({ id: p.id, _type: 'out', kind: 'expense', name: p.carrier_name || 'Перевозчик', pp: p.pp_number, date: p.date, amount: p.amount || 0, gradKey: p.carrier_name || '' })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  let filtered = [...allPayments]
  if (typeFilter === 'income') filtered = filtered.filter(p => p.kind === 'income')
  if (typeFilter === 'expense') filtered = filtered.filter(p => p.kind === 'expense')

  const PREVIEW_COUNT = 10
  const visiblePayments = (typeFilter === 'all' && !showAllIn)
    ? filtered.slice(0, PREVIEW_COUNT)
    : filtered

  const handleDelete = async p => {
    try {
      if (p._type === 'in') {
        await deletePaymentIn(p.id)
        setPaymentsIn(prev => prev.filter(x => x.id !== p.id))
      } else {
        await deletePaymentOut(p.id)
        setPaymentsOut(prev => prev.filter(x => x.id !== p.id))
      }
    } catch (e) { console.error(e) }
  }

  const clientNames = [...new Set(paymentsIn.map(p => p.client_name).filter(Boolean))]
  const carrierNames = [...new Set(paymentsOut.map(p => p.carrier_name).filter(Boolean))]
  const actNames = actPartyType === 'clients' ? clientNames : carrierNames

  const actPayments = actParty
    ? (actPartyType === 'clients'
      ? paymentsIn.filter(p => p.client_name === actParty).map(p => ({ ...p, kind: 'income' }))
      : paymentsOut.filter(p => p.carrier_name === actParty).map(p => ({ ...p, kind: 'expense' }))
    ) : []

  let balance = 0
  const actRows = actPayments.map((p, i) => {
    if (p.kind === 'income') balance += p.amount || 0
    else balance -= p.amount || 0
    return { ...p, balance, n: i + 1 }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16 }}>
        <div style={{
          background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
          borderRadius: 22, padding: '26px 28px', color: '#fff',
          boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>ЧИСТАЯ ПРИБЫЛЬ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1 }}>{netProfit.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>BYN</div>
          <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Налог (6%)</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{taxReserve.toLocaleString('ru-RU')} BYN</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>На руках</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{cash.toLocaleString('ru-RU')} BYN</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #1E9E5A 0%, #15734A 100%)', borderRadius: 22, padding: '26px 24px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(30,158,90,0.4)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>ПОСТУПЛЕНИЯ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalIncome.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{paymentsIn.length} платежей</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #1366F0 0%, #0D4FB5 100%)', borderRadius: 22, padding: '26px 24px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(19,102,240,0.4)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>СПИСАНИЯ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalExpense.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{paymentsOut.length} платежей</div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Выручка от клиентов', val: fmtMoney(totalIncome), color: '#1E9E5A' },
          { label: 'Выплачено перевозчикам', val: fmtMoney(totalExpense), color: '#1366F0' },
          { label: 'Маржинальность', val: marginPct + '%', color: '#D97706' },
          { label: 'Налог (6%)', val: fmtMoney(taxReserve), color: '#C81923' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 18, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Payments */}
      <div className="card" style={{ padding: '20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', flex: 1 }}>Платежи</div>
          <button className="btn-ghost" onClick={() => onAddPayment('income')} style={{ borderColor: 'rgba(30,158,90,0.3)', color: '#1E9E5A' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Поступление
          </button>
          <button className="btn-ghost" onClick={() => onAddPayment('expense')} style={{ borderColor: 'rgba(19,102,240,0.3)', color: '#1366F0' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Списание
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[{ k: 'all', l: 'Все' }, { k: 'income', l: 'Поступления' }, { k: 'expense', l: 'Списания' }].map(f => (
            <button key={f.k} onClick={() => { setTypeFilter(f.k); setShowAllIn(false) }} style={{
              padding: '5px 13px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
              background: typeFilter === f.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
              color: typeFilter === f.k ? '#fff' : '#5A6573',
            }}>{f.l}</button>
          ))}
        </div>
        {loading && <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {visiblePayments.map((p, i) => {
            const [avA, avB] = getGradient(p.gradKey)
            return (
              <div key={`${p._type}-${p.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 12px', borderRadius: 12,
                background: i % 2 === 0 ? 'rgba(14,23,38,0.02)' : 'transparent',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>{initials(p.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 1 }}>
                    {p.kind === 'income' ? 'Поступление' : 'Списание'}{p.pp ? ' · ' + p.pp : ''}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#A6AEB8' }}>{p.date}</div>
                <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: p.kind === 'income' ? '#1E9E5A' : '#1366F0', flexShrink: 0 }}>
                  {p.kind === 'income' ? '+' : '-'}{(p.amount || 0).toLocaleString('ru-RU')} BYN
                </div>
                <button onClick={() => handleDelete(p)} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.1)', color: '#C81923', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )
          })}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', color: '#A6AEB8', fontSize: 14 }}>Нет платежей</div>
          )}
        </div>
        {filtered.length > PREVIEW_COUNT && (
          <button
            onClick={() => setShowAllIn(v => !v)}
            style={{
              width: '100%', marginTop: 12, padding: '10px', borderRadius: 12,
              border: '1px solid rgba(19,102,240,0.2)', background: 'rgba(19,102,240,0.04)',
              cursor: 'pointer', fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, color: '#1366F0',
            }}
          >
            {showAllIn ? 'Свернуть' : `Показать все (${filtered.length})`}
          </button>
        )}
      </div>

      {/* Act sverki — manual table */}
      <div className="card" style={{ padding: '20px 20px' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 16 }}>Акт сверки</div>
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
          <select value={actParty} onChange={e => setActParty(e.target.value)} className="form-input"
            style={{ height: 36, padding: '0 12px', minWidth: 200, fontSize: 13 }}>
            <option value="">— Выберите контрагента —</option>
            {actNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {actRows.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(14,23,38,0.08)' }}>
                {['№', 'Документ', 'Дата', 'Приход', 'Расход', 'Сальдо'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actRows.map(row => (
                <tr key={`${row.kind}-${row.id}`} style={{ borderBottom: '1px solid rgba(14,23,38,0.04)' }}>
                  <td style={{ padding: '10px 12px', color: '#A6AEB8' }}>{row.n}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1366F0' }}>{row.pp_number || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#5A6573' }}>{row.date || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#1E9E5A', fontWeight: 700 }}>{row.kind === 'income' ? (row.amount || 0).toLocaleString('ru-RU') + ' BYN' : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#1366F0', fontWeight: 700 }}>{row.kind === 'expense' ? (row.amount || 0).toLocaleString('ru-RU') + ' BYN' : '—'}</td>
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

      {/* Generate reconciliation doc */}
      <div className="card" style={{ padding: '20px 20px' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 16 }}>Сформировать акт сверки (документ)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#A6AEB8' }}>Тип</label>
            <select value={recType} onChange={e => setRecType(e.target.value)} className="form-input"
              style={{ height: 36, padding: '0 10px', fontSize: 13, minWidth: 130 }}>
              <option value="client">Клиент</option>
              <option value="carrier">Перевозчик</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#A6AEB8' }}>Контрагент (ID или имя)</label>
            <input
              value={recPartyId}
              onChange={e => setRecPartyId(e.target.value)}
              placeholder="ID или название..."
              className="form-input"
              style={{ height: 36, padding: '0 10px', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#A6AEB8' }}>Период</label>
            <select value={recPeriod} onChange={e => setRecPeriod(e.target.value)} className="form-input"
              style={{ height: 36, padding: '0 10px', fontSize: 13, minWidth: 140 }}>
              <option value="month">Этот месяц</option>
              <option value="last_month">Прошлый месяц</option>
              <option value="quarter">Квартал</option>
              <option value="year">Год</option>
              <option value="all">Всё время</option>
            </select>
          </div>
          <button
            onClick={handleGenerateReconciliation}
            disabled={recLoading || !recPartyId}
            style={{
              height: 36, padding: '0 18px', borderRadius: 12, border: 'none', cursor: recPartyId ? 'pointer' : 'not-allowed',
              background: recPartyId ? '#1366F0' : 'rgba(14,23,38,0.08)',
              color: recPartyId ? '#fff' : '#A6AEB8',
              fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, opacity: recLoading ? 0.7 : 1,
            }}
          >
            {recLoading ? 'Генерация...' : 'Сформировать'}
          </button>
        </div>
        {recHistory.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A6AEB8', letterSpacing: '0.08em', marginBottom: 8 }}>ИСТОРИЯ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recHistory.slice(0, 5).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                  <span style={{ color: '#5A6573' }}>{r.date || r.created_at?.slice(0, 10)}</span>
                  <span style={{ fontWeight: 600, color: '#0E1726', flex: 1 }}>{r.counterparty_name || r.counterparty_id}</span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#1366F0', fontWeight: 600, textDecoration: 'none' }}>Открыть</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
