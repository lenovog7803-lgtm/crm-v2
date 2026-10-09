import { useState, useEffect, useCallback } from 'react'
import { getFleetOrder, updateFleetOrder, generateFleetDoc, addFleetOrderPayment, deleteFleetOrderPayment, duplicateFleetOrder, addFleetComment, deleteFleetComment } from '../../api'
import { useToast } from '../../components/Toast'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { initials, getGradient } from '../../utils'
import { FleetOrderModal, fmtDate } from './FleetOrderModal'
import { TRIP_STATUS } from './FleetTripDetail'
import FleetPaymentModal from './FleetPaymentModal'
import { SlidingTabs } from '../../components/SlidingTabs'
import { PillBtn } from './fleetUi'
import { Loader } from '../../components/Loader'
import { SwapText } from '../../components/Transitions'
import Switch from '../../components/Switch'

const sLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 12 }
const SLabel = ({ children }) => <div style={sLabel}>{children}</div>
const iStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E8EAEE',
  background: '#F7F8FA', fontSize: 13, color: '#0E1726', boxSizing: 'border-box',
}
const lbl = { fontSize: 10, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }
const today = () => new Date().toISOString().slice(0, 10)
const joinDot = (...xs) => xs.filter(Boolean).join('  ·  ')
const money = (v, cur) => `${Math.round(Number(v) || 0).toLocaleString('ru-RU')} ${cur || 'BYN'}`

// Строка-шаг корреспонденции — стиль документооборота экспедирования.
function Step({ done, label, sub, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
      cursor: onToggle ? 'pointer' : 'default', userSelect: 'none',
      background: done ? 'rgba(30,158,90,0.06)' : 'rgba(14,23,38,0.03)',
      border: `1px solid ${done ? 'rgba(30,158,90,0.2)' : 'rgba(14,23,38,0.07)'}`,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        background: done ? '#1E9E5A' : 'transparent', border: `2px solid ${done ? '#1E9E5A' : '#C4CAD4'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: done ? '#1E9E5A' : '#0E1726' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#1E9E5A', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: done ? '#1E9E5A' : '#A6AEB8', flexShrink: 0 }}>{done ? 'готово' : 'отметить'}</div>
    </div>
  )
}

function StepModal({ title, fields, onClose, onConfirm }) {
  useEscapeKey(onClose)
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map(f => [f.key, f.default ?? ''])))
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setVals(p => ({ ...p, [k]: v }))
  const go = async () => { setSaving(true); try { await onConfirm(vals) } catch { setSaving(false) } }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 400, padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)' }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: '#0E1726', marginBottom: 18 }}>{title}</div>
        {fields.map((f, i) => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <div style={lbl}>{f.label}</div>
            <input type={f.type || 'text'} value={vals[f.key]} autoFocus={i === 0}
              onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder || ''} style={{ ...iStyle, padding: '11px 14px', fontSize: 14 }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', fontSize: 14, color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
          <button onClick={go} disabled={saving} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: '#1E9E5A', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            <SwapText>{saving ? 'Сохраняю…' : 'Подтвердить'}</SwapText>
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  if (value === '' || value == null) return null
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
      <span style={{ color: '#A6AEB8', minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#0E1726', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// Строка документа справа — как в экспедировании (иконка + «+ Создать»/«Открыть»).
function DocRow({ label, url, color, bg, busy, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: bg, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 500, color: url ? color : '#8A93A0', overflow: 'hidden' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <button onClick={onClick} disabled={busy} style={{
        border: 'none', background: bg, color, borderRadius: 10, padding: '10px 14px',
        fontSize: 12.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      }}>{busy ? '…' : url ? 'Открыть' : '+ Создать'}</button>
    </div>
  )
}

// Частичные оплаты от клиента: список ПП + добавить + прогресс + просрочка.
function PaymentsCard({ order, cur, onReload, onFull }) {
  const { show } = useToast()
  const [adding, setAdding] = useState(false)
  const [amt, setAmt] = useState('')
  const [pp, setPp] = useState('')
  const [date, setDate] = useState(today())
  const [cash, setCash] = useState(false)

  const rate = Number(order.rate) || 0
  const pays = Array.isArray(order.payments) ? order.payments : []
  const paidAmt = order.paid_amount ?? pays.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining = Math.max(0, rate - paidAmt)
  const pct = rate > 0 ? Math.min(100, Math.round(paidAmt / rate * 100)) : (order.paid ? 100 : 0)
  const overdue = order.overdue || (order.due_date && !order.paid && order.due_date < today())

  const addPay = async () => {
    const amount = Number(String(amt).replace(',', '.'))
    if (!amount || amount <= 0) { show('Введите сумму', { type: 'error' }); return }
    try {
      await addFleetOrderPayment(order.id, { amount, pp_number: pp, date, cash })
      setAmt(''); setPp(''); setCash(false); setAdding(false)
      onReload()
      show('Платёж добавлен', { type: 'success' })
    } catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  const delPay = async (pid) => {
    if (!window.confirm('Удалить этот платёж?')) return
    try { await deleteFleetOrderPayment(order.id, pid); onReload() }
    catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }

  return (
    <div className="card" style={{ padding: '20px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <SLabel>ОПЛАТА ОТ КЛИЕНТА</SLabel>
        <span style={{
          fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px',
          color: order.paid ? '#1E9E5A' : overdue ? '#C81923' : '#D97706',
          background: order.paid ? 'rgba(30,158,90,0.1)' : overdue ? 'rgba(200,25,35,0.1)' : 'rgba(217,119,6,0.1)',
        }}>
          {order.paid ? 'оплачен' : overdue ? 'просрочен' : 'ожидается'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        <span style={{ color: '#1E9E5A' }}>{money(paidAmt, cur === 'BYN' ? 'Br' : cur)}</span>
        <span style={{ color: '#A6AEB8' }}>из {money(rate, cur === 'BYN' ? 'Br' : cur)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(14,23,38,0.06)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: order.paid ? '#1E9E5A' : '#1366F0', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: overdue ? '#C81923' : '#A6AEB8', marginBottom: 12 }}>
        {remaining > 0 ? `Осталось ${money(remaining, cur === 'BYN' ? 'Br' : cur)}` : 'Полностью оплачен'}
        {order.due_date && `  ·  срок ${fmtDate(order.due_date)}`}
      </div>

      {pays.map(p => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '7px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
          <span style={{ color: '#8A93A0' }}>
            {fmtDate(p.date)}{p.cash ? '  ·  наличными' : p.pp_number ? `  ·  ПП №${p.pp_number}` : ''}
          </span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <b style={{ fontFamily: 'var(--font-mono)', color: '#0E1726' }}>{money(p.amount, cur === 'BYN' ? 'Br' : cur)}</b>
            <button onClick={() => delPay(p.id)} style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </span>
        </div>
      ))}

      {adding ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="Сумма" autoFocus style={{ ...iStyle, flex: 1 }} />
            <input value={pp} onChange={e => setPp(e.target.value)} placeholder="№ ПП" style={{ ...iStyle, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...iStyle, flex: 1 }} />
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#5A6573', whiteSpace: 'nowrap' }}>
              <Switch size="sm" checked={cash} onChange={e => setCash(e.target.checked)} /> наличными
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 10, borderRadius: 10, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer', fontSize: 12 }}>Отмена</button>
            <button onClick={addPay} className="btn-primary" style={{ flex: 2, padding: 10, fontSize: 12 }}>Добавить платёж</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => setAdding(true)} style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #1366F0', background: 'rgba(19,102,240,0.06)', color: '#1366F0', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ платёж</button>
          {!order.paid && (
            <button onClick={onFull} style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #1E9E5A', background: 'rgba(30,158,90,0.06)', color: '#1E9E5A', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Оплачен полностью</button>
          )}
        </div>
      )}
    </div>
  )
}

// Комментарии к заказу
function OrderComments({ orderId, comments, onReload }) {
  const { show } = useToast()
  const [text, setText] = useState('')
  const list = Array.isArray(comments) ? comments : []
  const add = async () => {
    if (!text.trim()) return
    try { await addFleetComment('orders', orderId, text.trim()); setText(''); onReload() }
    catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  const del = async (cid) => {
    try { await deleteFleetComment('orders', orderId, cid); onReload() }
    catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  return (
    <div className="card" style={{ padding: '20px 20px' }}>
      <SLabel>КОММЕНТАРИИ</SLabel>
      {list.map(c => (
        <div key={c.id} style={{ padding: '7px 0', borderBottom: '1px solid rgba(14,23,38,0.05)', fontSize: 12.5, color: '#3A424E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: '#A6AEB8', fontSize: 11 }}>{c.author || '—'} · {fmtDate(c.created_at)}</span>
            <button onClick={() => del(c.id)} style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
          <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{c.text}</div>
        </div>
      ))}
      {list.length === 0 && <div style={{ fontSize: 12, color: '#A6AEB8', padding: '2px 0 10px' }}>Пока нет</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Добавить комментарий…" style={{ ...iStyle }} />
        <button onClick={add} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}>ОК</button>
      </div>
    </div>
  )
}

export default function FleetOrderDetail({ orderId, onBack }) {
  const { show } = useToast()
  const [order, setOrder] = useState(null)
  const [editing, setEditing] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [stepModal, setStepModal] = useState(null)
  const [genBusy, setGenBusy] = useState('')

  const load = useCallback(() => getFleetOrder(orderId).then(setOrder).catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' })), [orderId, show])
  useEffect(() => { load() }, [load])

  if (!order) return <Loader padding={20} />

  const ourContract = order.is_our_contract !== false
  const cur = order.currency || 'BYN'
  const patch = async (data) => {
    try { await updateFleetOrder(order.id, data); await load() }
    catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  // Снятие любой отметки — с подтверждением и возможностью вернуть.
  const unmark = async (label, offData, restoreData) => {
    if (!window.confirm(`Снять отметку «${label}»? Можно будет вернуть.`)) return
    try {
      await updateFleetOrder(order.id, offData)
      await load()
      show(`${label} — снято`, {
        type: 'info', actionLabel: 'Отменить',
        onAction: async () => { await updateFleetOrder(order.id, restoreData); await load(); show(`${label} — возвращено`, { type: 'success' }) },
      })
    } catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
  }
  const generate = async (kind) => {
    setGenBusy(kind)
    try {
      const r = await generateFleetDoc(order.id, kind)
      if (r?.url) { window.open(r.url, '_blank'); await load() }
      else show('Документ создан, но ссылка не получена', { type: 'error' })
    } catch (e) { show(e.message || 'Генерация ещё не настроена', { type: 'error' }) }
    setGenBusy('')
  }

  const route = `${order.loading_address || '—'} → ${order.unloading_address || '—'}`
  const cargoStr = joinDot(order.cargo_name, order.weight_tons && `${order.weight_tons} т`, order.pallets_count && `${order.pallets_count} палет`, order.volume_m3 && `${order.volume_m3} м³`)
  const [avA, avB] = getGradient(order.client_name || '')
  const col = { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <PillBtn variant="neutral" icon="back" onClick={onBack}>Назад</PillBtn>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 16, color: '#0E1726' }}>{order.order_number || order.client_name || 'Загрузка'}</span>
          <span style={{ fontSize: 12, color: '#A6AEB8', marginLeft: 10 }}>{order.client_name} · {order.trip_name || 'Рейс'} · {order.direction === 'backward' ? 'обратка' : 'прямой'}</span>
        </div>
        <PillBtn variant="edit" icon="edit" onClick={() => setEditing(true)}>Редактировать</PillBtn>
        <PillBtn variant="neutral" icon="dup" onClick={async () => {
          try { await duplicateFleetOrder(order.id); show('Заказ продублирован — новый в том же рейсе', { type: 'success' }); onBack() }
          catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
        }}>Дублировать</PillBtn>
      </div>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* ЛЕВАЯ КОЛОНКА */}
        <div style={col}>
          {/* Тёмная hero-карточка */}
          <div style={{
            background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
            borderRadius: 22, padding: '28px 28px', color: '#fff',
            boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>ЗАГРУЗКА</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{route}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 18 }}>
              <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Груз</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{order.cargo_name || cargoStr || '—'}</div></div>
              <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Вес / объём</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{joinDot(order.weight_tons && `${order.weight_tons} т`, order.volume_m3 && `${order.volume_m3} м³`) || '—'}</div></div>
              <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Загрузка</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(order.load_date)}</div></div>
              <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Выгрузка</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(order.unload_date)}</div></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Цена клиенту</div>
                <div style={{ fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-sys)' }}>{money(order.rate, cur)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Оплата</div>
                <div style={{ fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-sys)', color: order.paid ? '#5BE89B' : '#F5B971' }}>
                  {order.paid ? 'Оплачено' : 'Не поступила'}
                </div>
              </div>
            </div>
          </div>

          {/* Статус груза */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>СТАТУС ГРУЗА</SLabel>
            <SlidingTabs
              options={TRIP_STATUS.map(s => ({ key: s.key, label: s.label }))}
              value={order.cargo_status || 'active'}
              onChange={s => patch({ cargo_status: s })}
            />
          </div>

          {/* Оплата — частичные платежи от клиента */}
          <PaymentsCard order={order} cur={cur} onReload={load} onFull={() => setPayModal(true)} />

          {/* Корреспонденция */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>КОРРЕСПОНДЕНЦИЯ</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Step
                done={!!order.letter_sent_to_client}
                label="Письмо отправлено клиенту"
                sub={order.letter_sent_to_client
                  ? `${fmtDate(order.letter_sent_date)}${order.client_act_number ? `  ·  акт № ${order.client_act_number}` : ''}${order.client_act_date ? ` от ${fmtDate(order.client_act_date)}` : ''}`
                  : null}
                onToggle={() => (order.letter_sent_to_client
                  ? unmark('Письмо отправлено клиенту',
                      { letter_sent_to_client: false, letter_sent_date: null },
                      { letter_sent_to_client: true, letter_sent_date: order.letter_sent_date || today() })
                  : setStepModal('sent'))}
              />
              <Step
                done={!!order.letter_received_from_client}
                label="Получено от клиента"
                sub={order.letter_received_from_client ? fmtDate(order.letter_received_date) : null}
                onToggle={() => (order.letter_received_from_client
                  ? unmark('Получено от клиента',
                      { letter_received_from_client: false, letter_received_date: null },
                      { letter_received_from_client: true, letter_received_date: order.letter_received_date || today() })
                  : setStepModal('received'))}
              />
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div style={col}>
          {/* Клиент */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>КЛИЕНТ</SLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14,
              }}>{initials(order.client_name || '—')}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0E1726', minWidth: 0 }}>{order.client_name || 'Не указан'}</div>
            </div>
            {(order.shipper_name || order.consignee_name) && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#8A93A0', lineHeight: 1.6 }}>
                {order.shipper_name && <div>Отправитель: {joinDot(order.shipper_name, order.shipper_phone)}</div>}
                {order.consignee_name && <div>Получатель: {joinDot(order.consignee_name, order.consignee_phone)}</div>}
              </div>
            )}
          </div>

          {/* Документы */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>ДОКУМЕНТЫ</SLabel>
            <div style={{ marginBottom: 12 }}>
              <SlidingTabs
                options={[{ key: 'our', label: 'Наш договор' }, { key: 'client', label: 'Договор клиента' }]}
                value={ourContract ? 'our' : 'client'}
                onChange={k => patch({ is_our_contract: k === 'our' })}
              />
            </div>
            {ourContract ? (
              <DocRow label={order.doc_url_order ? 'Договор' : 'Заявка-договор'} url={order.doc_url_order}
                color="#1366F0" bg="rgba(19,102,240,0.08)" busy={genBusy === 'order'}
                onClick={() => (order.doc_url_order ? window.open(order.doc_url_order, '_blank') : generate('order'))} />
            ) : (
              <div style={{ marginBottom: 8 }}>
                <div style={lbl}>Номер договора клиента</div>
                <input defaultValue={order.contract_number || ''} placeholder="напр. 214/2026"
                  onBlur={e => e.target.value !== (order.contract_number || '') && patch({ contract_number: e.target.value })}
                  style={iStyle} />
              </div>
            )}
            <DocRow label="Акт выполненных работ" url={order.doc_url_act}
              color="#1E9E5A" bg="rgba(30,158,90,0.08)" busy={genBusy === 'act'}
              onClick={() => (order.doc_url_act ? window.open(order.doc_url_act, '_blank') : generate('act'))} />
            <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 6 }}>Генерация подключится с реквизитами юрлица и шаблонами.</div>
          </div>

          {/* Документы перевозки — номера, вносятся по ходу */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>ДОКУМЕНТЫ ПЕРЕВОЗКИ</SLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['cmr_number', '№ CMR'], ['waybill_number', '№ ТТН / ТН'], ['invoice_number', '№ счёта']].map(([k, lab]) => (
                <div key={k}>
                  <div style={lbl}>{lab}</div>
                  <input defaultValue={order[k] || ''} placeholder={lab}
                    onBlur={e => e.target.value !== (order[k] || '') && patch({ [k]: e.target.value })} style={iStyle} />
                </div>
              ))}
            </div>
          </div>

          {/* Груз и маршрут */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>ГРУЗ И МАРШРУТ</SLabel>
            <InfoRow label="Отправка" value={joinDot(order.city_from, order.loading_address)} />
            <InfoRow label="Получение" value={joinDot(order.city_to, order.unloading_address)} />
            <InfoRow label="Груз" value={joinDot(order.weight_tons && `${order.weight_tons} т`, order.pallets_count && `${order.pallets_count} палет`, order.pallet_size, order.volume_m3 && `${order.volume_m3} м³`)} />
            <InfoRow label="Ставка" value={money(order.rate, cur)} />
            <InfoRow label="Отсрочка платежа" value={order.pay_deferral_days ? `${order.pay_deferral_days} дн.` : ''} />
            <InfoRow label="Срок оплаты" value={order.due_date ? fmtDate(order.due_date) : ''} />
          </div>

          <OrderComments orderId={order.id} comments={order.comments} onReload={load} />
        </div>
      </div>

      {editing && <FleetOrderModal order={order} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
      {payModal && <FleetPaymentModal order={order} onClose={() => setPayModal(false)} onSaved={() => { setPayModal(false); load() }} />}

      {stepModal === 'sent' && (
        <StepModal
          title="Письмо отправлено клиенту"
          fields={[
            { key: 'letter_sent_date', label: 'Дата отправки', type: 'date', default: today() },
            { key: 'client_act_number', label: 'Номер акта', placeholder: 'напр. 214' },
            { key: 'client_act_date', label: 'Дата акта', type: 'date' },
          ]}
          onClose={() => setStepModal(null)}
          onConfirm={async (v) => { await patch({ letter_sent_to_client: true, ...v, letter_sent_date: v.letter_sent_date || today() }); setStepModal(null) }}
        />
      )}
      {stepModal === 'received' && (
        <StepModal
          title="Получено от клиента"
          fields={[{ key: 'letter_received_date', label: 'Дата получения', type: 'date', default: today() }]}
          onClose={() => setStepModal(null)}
          onConfirm={async (v) => { await patch({ letter_received_from_client: true, letter_received_date: v.letter_received_date || today() }); setStepModal(null) }}
        />
      )}
    </div>
  )
}
