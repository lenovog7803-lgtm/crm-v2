import { useState, useEffect } from 'react'
import { getMissingPP, getKudirEntries, updateKudirEntry, unlockKudirEntry, exportKudirUrl, updateOrder, resyncKudir } from '../api'
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
  const [search, setSearch] = useState('')
  const [resyncing, setResyncing] = useState(false)

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    const q = quarter === 'all' ? null : Number(quarter)
    const qStartMonth = q ? (q - 1) * 3 + 1 : 1
    const qEndMonth = q ? qStartMonth + 2 : 12
    const lastDay = new Date(year, qEndMonth, 0).getDate()
    const dateFrom = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
    const dateTo = `${year}-${String(qEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return getKudirEntries(dateFrom, dateTo)
      .then(r => { setEntries(r.entries || []); setTotalIncome(r.total_income || 0) })
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => { if (!silent) setLoading(false) })
  }
  // Row edits refetch silently — no full-table spinner flash for saving
  // one field, just the row's lock badge appearing once the response lands.
  const reloadSilently = () => load(true)

  useEffect(() => { load() }, [year, quarter])

  const download = () => {
    window.open(exportKudirUrl(year, quarter === 'all' ? null : Number(quarter)), '_blank')
  }

  // Прогоняет книгу заново по всем заявкам: снимает строки заявок с
  // оплатой налом от клиента, пересчитывает маржу там, где перевозчику
  // заплачено налом (его стоимость в расход не идёт), и правит
  // формулировку «Акт б/н». Ручные правки (🔒) не трогает.
  const resync = async () => {
    if (resyncing) return
    setResyncing(true)
    try {
      const r = await resyncKudir()
      show(`Книга пересчитана: обработано заявок ${r.orders_processed}`, { type: 'success' })
      load()
    } catch (e) {
      show('Ошибка пересчёта: ' + e.message, { type: 'error' })
    }
    setResyncing(false)
  }

  // Counterparty lives in free text, not its own column — the client's name
  // sits in `content` ("Оплата от X…"), the carrier's in `note` ("… —
  // перевозчику Y"). Matching both against one search box covers either
  // side without needing a schema change.
  const needle = search.trim().toLowerCase()
  const filteredEntries = needle
    ? entries.filter(e => (
        (e.content || '').toLowerCase().includes(needle) ||
        (e.note || '').toLowerCase().includes(needle) ||
        (e.order_number || '').toLowerCase().includes(needle) ||
        (e.document_ref || '').toLowerCase().includes(needle)
      ))
    : entries
  const filteredIncome = filteredEntries.reduce((s, e) => s + (e.income_amount || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <SlidingTabs
          options={YEARS.map(y => ({ key: String(y), label: String(y) }))}
          value={String(year)}
          onChange={v => setYear(Number(v))}
        />
        <SlidingTabs options={QUARTERS} value={quarter} onChange={setQuarter} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по контрагенту или заявке…"
          style={{
            flex: '1 1 220px', minWidth: 180, padding: '9px 12px', borderRadius: 10,
            border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 13, color: '#0E1726',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={resync}
          disabled={resyncing}
          title="Пересчитать книгу по всем заявкам (нал, «Акт б/н», группировка ПП). Ручные правки не трогает."
          style={{ marginLeft: 'auto', padding: '9px 16px', borderRadius: 10, background: '#fff', color: '#0E1726', border: '1px solid #E8EAEE', fontSize: 13, fontWeight: 600, cursor: resyncing ? 'default' : 'pointer', opacity: resyncing ? 0.6 : 1 }}
        >
          {resyncing ? 'Пересчёт…' : 'Пересчитать'}
        </button>
        <button
          onClick={download}
          style={{ padding: '9px 16px', borderRadius: 10, background: '#1366F0', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Скачать
        </button>
      </div>

      <div className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#5A6573' }}>
          {needle ? `Найдено: ${filteredEntries.length} из ${entries.length}` : `Записей: ${entries.length}`}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1E9E5A' }}>
          {needle ? `Доход по найденному: ${fmtMoney(filteredIncome)}` : `Доход за период: ${fmtMoney(totalIncome)}`}
        </div>
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
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#A6AEB8' }}>
                {needle ? 'Ничего не найдено' : 'Нет записей за период'}
              </td></tr>
            ) : (
              filteredEntries.map(e => (
                <EntryRow key={e.id} entry={e} onChanged={reloadSilently} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Any cell in a row can be hand-corrected — once you touch one, the whole
// row is marked manually_edited on the backend and the order-driven
// auto-sync stops overwriting it on the next payment change. "Снять
// правку" reverts that so the row goes back to being computed from the
// order automatically.
const cellInputStyle = {
  width: '100%', border: '1px solid transparent', background: 'transparent',
  padding: '6px 8px', borderRadius: 8, fontSize: 12, fontFamily: 'Manrope', color: '#0E1726',
  boxSizing: 'border-box',
}
const focusCell = e => { e.target.style.border = '1px solid #E0473B4D'; e.target.style.background = '#fff' }
const blurCell = e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' }

function EntryRow({ entry, onChanged }) {
  const { show } = useToast()
  const [fields, setFields] = useState({
    entry_date: (entry.entry_date || '').slice(0, 10),
    document_ref: entry.document_ref || '',
    content: entry.content || '',
    income_amount: entry.income_amount,
    note: entry.note || '',
  })
  const [saving, setSaving] = useState(null) // which field key is saving

  const save = async (key, value) => {
    const orig = key === 'entry_date' ? (entry.entry_date || '').slice(0, 10) : (entry[key] ?? (key === 'income_amount' ? null : ''))
    if (value === orig) return
    setSaving(key)
    try {
      await updateKudirEntry(entry.id, { [key]: key === 'income_amount' ? (value === '' ? null : Number(value)) : value })
      show('Сохранено', { type: 'success' })
      onChanged?.()
    } catch (e) {
      show('Ошибка сохранения: ' + e.message, { type: 'error' })
    }
    setSaving(null)
  }

  const revert = async () => {
    try {
      await unlockKudirEntry(entry.id)
      show('Правка снята — строка снова считается автоматически', { type: 'info' })
      onChanged?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const locked = !!entry.manually_edited

  return (
    <tr style={{ borderTop: '1px solid #F0F1F4', background: locked ? 'rgba(19,102,240,0.03)' : 'transparent' }}>
      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
        <input
          type="date"
          value={fields.entry_date}
          onChange={e => setFields(f => ({ ...f, entry_date: e.target.value }))}
          onFocus={focusCell}
          onBlur={e => { blurCell(e); save('entry_date', fields.entry_date) }}
          disabled={saving === 'entry_date'}
          style={cellInputStyle}
        />
      </td>
      <td style={{ padding: '6px 12px' }}>
        <input
          value={fields.document_ref}
          onChange={e => setFields(f => ({ ...f, document_ref: e.target.value }))}
          onFocus={focusCell}
          onBlur={e => { blurCell(e); save('document_ref', fields.document_ref) }}
          disabled={saving === 'document_ref'}
          style={cellInputStyle}
        />
      </td>
      <td style={{ padding: '6px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {locked && (
            <span title="Отредактировано вручную — не пересчитывается автоматически" style={{ fontSize: 13, flexShrink: 0 }}>🔒</span>
          )}
          <input
            value={fields.content}
            onChange={e => setFields(f => ({ ...f, content: e.target.value }))}
            onFocus={focusCell}
            onBlur={e => { blurCell(e); save('content', fields.content) }}
            disabled={saving === 'content'}
            style={cellInputStyle}
          />
        </div>
      </td>
      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
        <input
          type="number"
          value={fields.income_amount ?? ''}
          onChange={e => setFields(f => ({ ...f, income_amount: e.target.value }))}
          onFocus={focusCell}
          onBlur={e => { blurCell(e); save('income_amount', fields.income_amount) }}
          disabled={saving === 'income_amount'}
          style={{ ...cellInputStyle, textAlign: 'right', fontWeight: 600, color: fields.income_amount != null && fields.income_amount !== '' ? '#1E9E5A' : '#A6AEB8' }}
          placeholder="—"
        />
      </td>
      <td style={{ padding: '6px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            value={fields.note}
            onChange={e => setFields(f => ({ ...f, note: e.target.value }))}
            onFocus={focusCell}
            onBlur={e => { blurCell(e); save('note', fields.note) }}
            disabled={saving === 'note'}
            style={cellInputStyle}
          />
          {locked && (
            <button
              onClick={revert}
              title="Снять ручную правку — строка снова будет пересчитываться автоматически"
              style={{ flexShrink: 0, border: 'none', background: 'transparent', color: '#A6AEB8', fontSize: 10, cursor: 'pointer', padding: '2px 4px', whiteSpace: 'nowrap' }}
            >
              снять
            </button>
          )}
        </div>
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
