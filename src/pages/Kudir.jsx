import { useState, useEffect } from 'react'
import { getMissingPP, getKudirEntries, updateKudirEntry, exportKudirUrl, updateOrder } from '../api'
import { useToast } from '../components/Toast'
import { SlidingTabs } from '../components/SlidingTabs'
import { fmtMoney, fmtDate } from '../utils'

const TABS = [
  { key: 'backfill', label: 'Дозаполнить' },
  { key: 'book', label: 'Книга учёта' },
]

const inputStyle = {
  padding: '6px 8px', borderRadius: 8, border: '1px solid #E0473B4D', fontSize: 12,
  fontFamily: 'Manrope', color: '#0E1726',
}

const MISSING_FIELD_META = {
  client_pp: { label: 'ПП клиента', width: 95, placeholder: 'ПП клиента', dataKey: 'client_pp_number', dateKey: 'client_pp_date' },
  carrier_pp: { label: 'ПП перевозчику', width: 105, placeholder: 'ПП перевозчику', dataKey: 'carrier_pp_number', dateKey: 'carrier_pp_date' },
  act: { label: 'Номер акта', width: 100, placeholder: 'Номер акта', dataKey: 'carrier_act_number', dateKey: 'carrier_act_date' },
}

const today = () => new Date().toISOString().slice(0, 10)

function MissingPPRow({ order, onSaved }) {
  const { show } = useToast()
  const [values, setValues] = useState({
    client_pp: order.client_pp_number || '',
    carrier_pp: order.carrier_pp_number || '',
    act: order.carrier_act_number || '',
  })
  const [dates, setDates] = useState({
    client_pp: order.client_pp_date || today(),
    carrier_pp: order.carrier_pp_date || today(),
    act: order.carrier_act_date || today(),
  })
  const [saving, setSaving] = useState(false)
  const missing = order.missing_fields || []

  const save = async () => {
    const patch = {}
    for (const key of missing) {
      const meta = MISSING_FIELD_META[key]
      if (meta && values[key]) {
        patch[meta.dataKey] = values[key]
        if (meta.dateKey) patch[meta.dateKey] = dates[key] || today()
      }
    }
    if (!Object.keys(patch).length) return
    setSaving(true)
    try {
      await updateOrder(order.id, patch)
      show(`Заявка ${order.order_number}: сохранено`, { type: 'success' })
      onSaved()
    } catch (e) {
      show('Ошибка сохранения: ' + e.message, { type: 'error' })
    }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F0F1F4', flexWrap: 'wrap' }}>
      <div style={{ width: 110, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1366F0' }}>{order.order_number}</div>
      <div style={{ flex: 1, minWidth: 120, fontSize: 12, color: '#0E1726' }}>{order.client_name}</div>
      {missing.map(key => {
        const meta = MISSING_FIELD_META[key]
        if (!meta) return null
        return (
          <div key={key} style={{ display: 'flex', gap: 4 }}>
            <input
              value={values[key]}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
              placeholder={meta.placeholder}
              style={{ ...inputStyle, width: meta.width }}
            />
            {meta.dateKey && (
              <input
                type="date"
                value={dates[key]}
                onChange={e => setDates(d => ({ ...d, [key]: e.target.value }))}
                style={{ ...inputStyle, width: 130 }}
              />
            )}
          </div>
        )
      })}
      <button
        onClick={save}
        disabled={saving}
        style={{ padding: '6px 12px', borderRadius: 8, background: '#1366F0', color: '#fff', border: 'none', fontSize: 12, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? '...' : 'Сохранить'}
      </button>
    </div>
  )
}

function BackfillTab() {
  const { show } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getMissingPP()
      .then(r => setOrders(r.orders || []))
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F1F4', fontSize: 13, fontWeight: 600, color: '#0E1726' }}>
        Осталось дозаполнить: {orders.length}
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>Загрузка…</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>Всё заполнено</div>
      ) : (
        orders.map(order => <MissingPPRow key={order.id} order={order} onSaved={load} />)
      )}
    </div>
  )
}

const YEARS = [2025, 2026]
const QUARTERS = [
  { key: 'all', label: 'Весь год' },
  { key: '1', label: 'I кв.' },
  { key: '2', label: 'II кв.' },
  { key: '3', label: 'III кв.' },
  { key: '4', label: 'IV кв.' },
]

function BookTab() {
  const { show } = useToast()
  const [year, setYear] = useState(YEARS[YEARS.length - 1])
  const [quarter, setQuarter] = useState('all')
  const [entries, setEntries] = useState([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = quarter === 'all' ? null : Number(quarter)
    const qStartMonth = q ? (q - 1) * 3 + 1 : 1
    const qEndMonth = q ? qStartMonth + 2 : 12
    const lastDay = new Date(year, qEndMonth, 0).getDate()
    const dateFrom = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
    const dateTo = `${year}-${String(qEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    getKudirEntries(dateFrom, dateTo)
      .then(r => { setEntries(r.entries || []); setTotalIncome(r.total_income || 0) })
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }, [year, quarter])

  const download = () => {
    window.open(exportKudirUrl(year, quarter === 'all' ? null : Number(quarter)), '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <SlidingTabs
          options={YEARS.map(y => ({ key: String(y), label: String(y) }))}
          value={String(year)}
          onChange={v => setYear(Number(v))}
        />
        <SlidingTabs options={QUARTERS} value={quarter} onChange={setQuarter} />
        <button
          onClick={download}
          style={{ marginLeft: 'auto', padding: '9px 16px', borderRadius: 10, background: '#1366F0', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Скачать
        </button>
      </div>

      <div className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#5A6573' }}>Записей: {entries.length}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1E9E5A' }}>Доход за период: {fmtMoney(totalIncome)}</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F7F8FA', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px' }}>Дата</th>
              <th style={{ padding: '10px 12px' }}>Документ</th>
              <th style={{ padding: '10px 12px' }}>Содержание</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Доход</th>
              <th style={{ padding: '10px 12px' }}>Примечание</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#A6AEB8' }}>Нет записей за период</td></tr>
            ) : (
              entries.map(e => (
                <EntryRow key={e.id} entry={e} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EntryRow({ entry }) {
  const { show } = useToast()
  const [note, setNote] = useState(entry.note || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (note === (entry.note || '')) return
    setSaving(true)
    try {
      await updateKudirEntry(entry.id, { note })
      show('Примечание сохранено', { type: 'success' })
    } catch (e) {
      show('Ошибка сохранения: ' + e.message, { type: 'error' })
    }
    setSaving(false)
  }

  return (
    <tr style={{ borderTop: '1px solid #F0F1F4' }}>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(entry.entry_date)}</td>
      <td style={{ padding: '10px 12px' }}>{entry.document_ref}</td>
      <td style={{ padding: '10px 12px' }}>{entry.content}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: entry.income_amount != null ? '#1E9E5A' : '#A6AEB8' }}>
        {entry.income_amount != null ? fmtMoney(entry.income_amount) : '—'}
      </td>
      <td style={{ padding: '6px 12px' }}>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={save}
          disabled={saving}
          style={{ ...inputStyle, width: '100%', border: '1px solid transparent', background: 'transparent' }}
          onFocus={e => { e.target.style.border = '1px solid #E0473B4D'; e.target.style.background = '#fff' }}
        />
      </td>
    </tr>
  )
}

export default function Kudir() {
  const [tab, setTab] = useState('backfill')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'Onest', fontSize: 20, fontWeight: 800, color: '#0E1726', margin: 0 }}>КУДиР</h1>
        <SlidingTabs options={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === 'backfill' ? <BackfillTab /> : <BookTab />}
    </div>
  )
}
