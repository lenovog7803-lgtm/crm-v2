import { useState, useEffect } from 'react'
import { getOrders, getClients, getCarriers, generateReconciliation, getReconciliationHistory } from '../api'
import { fmtMoney, initials, getGradient } from '../utils'

export default function Finance({ onAddPayment, refreshKey }) {
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)

  const [actPartyType, setActPartyType] = useState('clients')
  const [actParty, setActParty] = useState('')

  const [recType, setRecType] = useState('client')
  const [recPartyId, setRecPartyId] = useState('')
  const [recPartyName, setRecPartyName] = useState('')
  const [recPeriod, setRecPeriod] = useState('month')
  const [recLoading, setRecLoading] = useState(false)
  const [recHistory, setRecHistory] = useState([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getOrders({ limit: 2000 }).catch(() => []),
      getClients().catch(() => []),
      getCarriers().catch(() => []),
    ]).then(([ords, cls, cars]) => {
      setOrders(Array.isArray(ords) ? ords : [])
      setClients(Array.isArray(cls) ? cls : [])
      setCarriers(Array.isArray(cars) ? cars : [])
    }).finally(() => setLoading(false))
    getReconciliationHistory({}).then(r => setRecHistory(Array.isArray(r) ? r : (r?.history || []))).catch(() => {})
  }, [refreshKey])

  // Поступления = заявки где client_paid=true
  const receipts = orders.filter(o => o.client_paid)
  // Списания = заявки где carrier_paid=true
  const expenses = orders.filter(o => o.carrier_paid)

  const totalIncome = receipts.reduce((s, o) => s + (o.client_rate || 0), 0)
  const totalExpense = expenses.reduce((s, o) => s + (o.carrier_rate || 0), 0)
  const netProfit = totalIncome - totalExpense
  const marginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0

  // Общий список для таблицы
  const allPayments = [
    ...receipts.map(o => ({ id: o.id, _type: 'in', kind: 'income', name: o.client_name || '—', date: o.client_paid_date?.slice(0, 10) || o.unload_date || '', amount: o.client_rate || 0, gradKey: o.client_name || '', order_number: o.order_number })),
    ...expenses.map(o => ({ id: o.id, _type: 'out', kind: 'expense', name: o.carrier_name || '—', date: o.carrier_paid_date?.slice(0, 10) || o.unload_date || '', amount: o.carrier_rate || 0, gradKey: o.carrier_name || '', order_number: o.order_number })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  let filtered = [...allPayments]
  if (typeFilter === 'income') filtered = filtered.filter(p => p.kind === 'income')
  if (typeFilter === 'expense') filtered = filtered.filter(p => p.kind === 'expense')

  const PREVIEW = 12
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW)

  // Акт сверки (таблица)
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

  const recList = recType === 'client' ? clients : carriers
  const recLabelKey = recType === 'client' ? 'name' : 'company_name'
  const iStyle = { height: 36, padding: '0 10px', fontSize: 13, borderRadius: 10, border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)', fontFamily: 'Manrope', color: '#0E1726', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)', borderRadius: 22, padding: '26px 28px', color: '#fff', boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>ЧИСТАЯ ПРИБЫЛЬ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1 }}>{netProfit.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>BYN</div>
          <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Поступления</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{totalIncome.toLocaleString('ru-RU')} BYN</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Списания</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{totalExpense.toLocaleString('ru-RU')} BYN</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #1E9E5A 0%, #15734A 100%)', borderRadius: 22, padding: '26px 24px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(30,158,90,0.4)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>ПОСТУПЛЕНИЯ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalIncome.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{receipts.length} заявок оплачено</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #1366F0 0%, #0D4FB5 100%)', borderRadius: 22, padding: '26px 24px', color: '#fff', boxShadow: '0 16px 40px -16px rgba(19,102,240,0.4)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>СПИСАНИЯ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{totalExpense.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{expenses.length} перевозчиков оплачено</div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Выручка от клиентов', val: fmtMoney(totalIncome), color: '#1E9E5A' },
          { label: 'Выплачено перевозчикам', val: fmtMoney(totalExpense), color: '#1366F0' },
          { label: 'Маржинальность', val: marginPct + '%', color: '#D97706' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 18, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Payments table */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', flex: 1 }}>Платежи</div>
          {[{ k: 'all', l: 'Все' }, { k: 'income', l: 'Поступления' }, { k: 'expense', l: 'Списания' }].map(f => (
            <button key={f.k} onClick={() => { setTypeFilter(f.k); setShowAll(false) }} style={{
              padding: '5px 13px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
              background: typeFilter === f.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
              color: typeFilter === f.k ? '#fff' : '#5A6573',
            }}>{f.l}</button>
          ))}
        </div>
        {loading && <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {visible.map((p, i) => {
            const [avA, avB] = getGradient(p.gradKey)
            return (
              <div key={`${p._type}-${p.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', borderRadius: 11,
                background: i % 2 === 0 ? 'rgba(14,23,38,0.02)' : 'transparent',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>{initials(p.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 1 }}>
                    {p.kind === 'income' ? 'Поступление от клиента' : 'Оплата перевозчику'}
                    {p.order_number ? ` · Заявка ${p.order_number}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#A6AEB8' }}>{p.date || '—'}</div>
                <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: p.kind === 'income' ? '#1E9E5A' : '#1366F0', flexShrink: 0 }}>
                  {p.kind === 'income' ? '+' : '-'}{(p.amount || 0).toLocaleString('ru-RU')} BYN
                </div>
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

      {/* Генерация акта сверки (документ) */}
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
