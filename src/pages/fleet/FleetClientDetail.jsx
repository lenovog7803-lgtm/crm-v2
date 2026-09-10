import { useState, useEffect, useCallback } from 'react'
import { getFleetClient, getFleetClientOrders, deleteFleetOrder, getFleetReconciliation } from '../../api'
import { useToast } from '../../components/Toast'
import { FleetClientModal } from './FleetClientModal'
import { fmtDate } from './FleetOrderModal'
import { PillBtn } from './fleetUi'

const fld = { height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid #E8EAEE', fontSize: 13, background: '#fff' }

// Акт сверки за период — открывается в отдельном окне для печати.
function ReconciliationModal({ clientId, clientName, onClose }) {
  const { show } = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)

  const build = async () => {
    setBusy(true)
    try {
      const p = {}
      if (from) p.date_from = from
      if (to) p.date_to = to
      const r = await getFleetReconciliation(clientId, p)
      const rows = (r.rows || []).map(x => `
        <tr><td>${x.date || ''}</td><td>${x.order_number || ''}</td><td>${x.route || ''}</td>
        <td class="r">${(x.charged || 0).toLocaleString('ru-RU')}</td>
        <td class="r">${(x.paid || 0).toLocaleString('ru-RU')}</td></tr>`).join('')
      const period = [from, to].filter(Boolean).join(' — ') || 'весь период'
      const w = window.open('', '_blank')
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Акт сверки — ${clientName}</title>
        <style>
          body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:40px}
          h1{font-size:17px}
          table{border-collapse:collapse;width:100%;margin-top:14px}
          th,td{border:1px solid #999;padding:6px 8px;text-align:left}
          .r{text-align:right;font-variant-numeric:tabular-nums}
          tfoot td{font-weight:bold;background:#f2f2f2}
          .muted{color:#666}
        </style></head><body>
        <h1>Акт сверки взаиморасчётов</h1>
        <div>Клиент: <b>${clientName}</b>${r.client?.unp ? ` · УНП ${r.client.unp}` : ''}</div>
        <div class="muted">Период: ${period} · сформировано ${new Date().toLocaleDateString('ru-RU')}</div>
        <table>
          <thead><tr><th>Дата</th><th>Заказ</th><th>Маршрут</th><th class="r">Начислено</th><th class="r">Оплачено</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Нет операций за период</td></tr>'}</tbody>
          <tfoot>
            <tr><td colspan="3">ИТОГО</td><td class="r">${(r.total_charged || 0).toLocaleString('ru-RU')}</td><td class="r">${(r.total_paid || 0).toLocaleString('ru-RU')}</td></tr>
            <tr><td colspan="4">Задолженность клиента</td><td class="r">${(r.balance || 0).toLocaleString('ru-RU')} Br</td></tr>
          </tfoot>
        </table>
        <p style="margin-top:40px">Исполнитель ____________________ &nbsp;&nbsp;&nbsp; Заказчик ____________________</p>
        <script>window.onload=()=>window.print()</script>
        </body></html>`)
      w.document.close()
      onClose()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: '#fff', borderRadius: 22, width: '100%', maxWidth: 380, padding: 24, boxShadow: '0 40px 80px rgba(20,30,55,0.28)' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 16, color: '#0E1726', marginBottom: 14 }}>Акт сверки</div>
        <div style={{ fontSize: 12, color: '#8A93A0', marginBottom: 12 }}>Период (можно оставить пустым — тогда за всё время)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...fld, flex: 1 }} />
          <span style={{ color: '#A6AEB8' }}>—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...fld, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
          <button onClick={build} disabled={busy} className="btn-primary" style={{ flex: 2, padding: 12 }}>{busy ? 'Готовлю…' : 'Сформировать'}</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0' }}>
      <span style={{ color: '#A6AEB8', minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#0E1726' }}>{value}</span>
    </div>
  )
}

function OrderRow({ order, onOpen, onReload }) {
  const { show } = useToast()
  const remove = async (e) => {
    e.stopPropagation()
    if (!window.confirm('Удалить заказ?')) return
    try { await deleteFleetOrder(order.id); onReload() }
    catch (err) { show('Ошибка: ' + err.message, { type: 'error' }) }
  }
  return (
    <div onClick={() => onOpen(order.id)} title="Открыть карточку загрузки" style={{ padding: '12px 0', borderBottom: '1px solid #F0F1F4', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726' }}>
          {order.order_number && <span style={{ fontFamily: 'JetBrains Mono', color: '#1366F0', fontSize: 12, marginRight: 6 }}>{order.order_number}</span>}
          {order.trip_name || 'Рейс'}
          <span style={{ color: '#A6AEB8', fontWeight: 400 }}> · {order.direction === 'backward' ? 'обратка' : 'прямой'}</span>
        </div>
        <button onClick={remove} title="Удалить" style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
      </div>
      {(order.loading_address || order.unloading_address) && (
        <div style={{ fontSize: 11, color: '#8A93A0', marginTop: 2 }}>{order.loading_address || '—'} → {order.unloading_address || '—'}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#8A93A0' }}>{fmtDate(order.load_date)} → {fmtDate(order.unload_date)}</span>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#1366F0' }}>{(order.rate || 0).toLocaleString('ru-RU')} Br</span>
      </div>
    </div>
  )
}

export default function FleetClientDetail({ clientId, onBack, onOpenOrder }) {
  const { show } = useToast()
  const [client, setClient] = useState(null)
  const [orders, setOrders] = useState([])
  const [editing, setEditing] = useState(false)
  const [reconcile, setReconcile] = useState(false)

  const load = useCallback(() => {
    return Promise.all([
      getFleetClient(clientId).then(setClient),
      getFleetClientOrders(clientId).then(r => setOrders(r.orders || [])),
    ]).catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
  }, [clientId, show])

  useEffect(() => { load() }, [load])

  if (!client) return <div style={{ color: '#A6AEB8', fontSize: 13, padding: 20 }}>Загрузка…</div>

  const total = orders.reduce((s, o) => s + (o.rate || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <PillBtn variant="neutral" icon="back" onClick={onBack}>Клиенты</PillBtn>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'Onest', fontWeight: 800, fontSize: 20, color: '#0E1726' }}>{client.name}</div>
        <PillBtn variant="neutral" icon="dup" onClick={() => setReconcile(true)}>Акт сверки</PillBtn>
        <PillBtn variant="edit" icon="edit" onClick={() => setEditing(true)}>Изменить</PillBtn>
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <Row label="Телефон" value={client.phone} />
        <Row label="Контактное лицо" value={client.contact_person} />
        <Row label="УНП" value={client.unp} />
        <Row label="Директор" value={client.director} />
        <Row label="Юридический адрес" value={client.legal_address || client.address} />
        <Row label="Почтовый адрес" value={client.postal_address} />
        <Row label="Действует на основании" value={client.basis} />
        <Row label="Банк" value={client.bank} />
        <Row label="БИК" value={client.bik} />
        <Row label="Расчётный счёт" value={client.rs} />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1726' }}>Заказы клиента · {orders.length}</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#1366F0' }}>{total.toLocaleString('ru-RU')} Br</div>
        </div>
        {orders.length === 0
          ? <div style={{ fontSize: 12, color: '#A6AEB8', textAlign: 'center', padding: 20 }}>Заказов пока нет</div>
          : orders.map(o => <OrderRow key={o.id} order={o} onOpen={onOpenOrder} onReload={load} />)}
      </div>

      {editing && (
        <FleetClientModal
          initial={client}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setEditing(false); setClient(updated) }}
        />
      )}
      {reconcile && (
        <ReconciliationModal clientId={clientId} clientName={client.name} onClose={() => setReconcile(false)} />
      )}
    </div>
  )
}
