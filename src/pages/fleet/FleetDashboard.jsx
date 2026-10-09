import { useState, useEffect } from 'react'
import { getFleetDashboard, fleetExportUrl, previewFleetBriefing, sendFleetBriefing } from '../../api'
import { useToast } from '../../components/Toast'
import { CountUp } from '../../components/CountUp'
import { TRIP_STATUS } from './FleetTripDetail'
import { PillBtn } from './fleetUi'
import { mouseOnly } from '../../motion'
import { Loader } from '../../components/Loader'
import Select from '../../components/Select'
import { iosConfirm } from '../../components/IOSAlert'

const money = v => `${Math.round(Number(v) || 0).toLocaleString('ru-RU')} BYN`
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const monthLabel = m => { const [y, mo] = m.split('-'); return `${MONTHS_RU[+mo - 1]} ${y}` }
const stColor = k => (TRIP_STATUS.find(s => s.key === k) || TRIP_STATUS[0]).color
const stLabel = k => (TRIP_STATUS.find(s => s.key === k) || TRIP_STATUS[0]).label

export default function FleetDashboard({ onOpenTrip, onOpenClient, onNav }) {
  const { show } = useToast()
  const [d, setD] = useState(null)
  const [month, setMonth] = useState('')

  useEffect(() => {
    getFleetDashboard(month).then(setD).catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
  }, [month, show])

  if (!d) return <Loader padding={20} state="composing" />

  const st = d.trips_by_status || {}
  const trips = d.trips || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 22, color: '#0E1726' }}>Дашборд</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Свой автопарк</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <PillBtn variant="edit" icon="plus" onClick={() => onNav?.('fleet-analytics')}>Аналитика</PillBtn>
          <PillBtn variant="neutral" icon="dup" onClick={async () => {
            try {
              const p = await previewFleetBriefing()
              const w = window.open('', '_blank')
              w.document.write(`<pre style="font:13px/1.5 -apple-system,Arial;white-space:pre-wrap;padding:24px;max-width:640px">${(p.text || '').replace(/<[^>]+>/g, '')}</pre>`)
              w.document.close()
              if (await iosConfirm('Отправить эту сводку в Telegram сейчас?')) {
                const r = await sendFleetBriefing()
                show(r.sent ? `Отправлено (${r.sent})` : 'Не отправлено — проверьте бота', { type: r.sent ? 'success' : 'error' })
              }
            } catch (e) { show('Ошибка: ' + e.message, { type: 'error' }) }
          }}>Сводка в TG</PillBtn>
          <a href={fleetExportUrl(month)} style={{ textDecoration: 'none' }}>
            <PillBtn variant="neutral" icon="dup">Excel</PillBtn>
          </a>
          <Select value={month} onChange={e => setMonth(e.target.value)} style={{
            height: 38, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.14)',
            background: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-sys)', fontSize: 13, color: '#0E1726', cursor: 'pointer',
          }}>
            <option value="">Всё время</option>
            {(d.months || []).map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </Select>
        </div>
      </div>

      {/* Hero row */}
      <div className="dashboard-big-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 16 }}>
        {/* Тёмная: прибыль */}
        <div style={{
          background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
          borderRadius: 22, padding: '28px 28px', color: '#fff',
          boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(19,102,240,0.15)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)' }}>ПРИБЫЛЬ ПО РЕЙСАМ</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4, color: d.profit >= 0 ? '#fff' : '#FF6B7A' }}>
              <CountUp value={d.profit} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>BYN</div>
            <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Выручка</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}><CountUp value={d.revenue} format={money} /></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Расходы</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#F5B971' }}><CountUp value={d.expenses} format={money} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Оранжевая: дебиторка */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,236,214,0.95), rgba(255,213,170,0.85))',
          borderRadius: 22, padding: '28px 24px', border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 16px 40px -16px rgba(217,119,6,0.4)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', bottom: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#A86A20', marginBottom: 8 }}>ОЖИДАЕТСЯ ОТ КЛИЕНТОВ</div>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#7A4A12' }}>
            <CountUp value={d.debt_sum} />
          </div>
          <div style={{ fontSize: 11, color: '#A86A20', marginTop: 6 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12, color: '#A86A20', fontWeight: 600 }}>оплачено {money(d.paid_sum)}</div>
        </div>

        {/* Фиолетовая: расходы по рейсам */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(224,224,255,0.95), rgba(208,191,255,0.85))',
          borderRadius: 22, padding: '28px 24px', border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 16px 40px -16px rgba(124,58,237,0.4)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', bottom: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#6B3FB8', marginBottom: 8 }}>РАСХОДЫ ПО РЕЙСАМ</div>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#4A2785' }}>
            <CountUp value={d.expenses} />
          </div>
          <div style={{ fontSize: 11, color: '#6B3FB8', marginTop: 6 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12, color: '#6B3FB8', fontWeight: 600 }}>
            топливо {money(d.fuel_cost)} · прочее {money(d.other_expenses)} · ЗП {money(d.driver_salary_total)}
          </div>
          {d.expenses_unpaid > 0.5 && (
            <div style={{ marginTop: 4, fontSize: 11.5, color: '#C81923', fontWeight: 700 }}>не оплачено {money(d.expenses_unpaid)}</div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="dashboard-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Рейсов', value: d.trips_total, color: '#1366F0', bg: 'rgba(19,102,240,0.08)',
            sub: `в пути ${st.in_transit || 0} · доставлено ${st.delivered || 0}`, onClick: () => onNav?.('fleet-trips') },
          { label: 'Заказов', value: d.orders_total, color: '#1E9E5A', bg: 'rgba(30,158,90,0.08)', sub: `доставлено ${int(d.delivered)}` },
          { label: 'Пробег, км', value: d.km, color: '#D97706', bg: 'rgba(217,119,6,0.08)', sub: `${(d.fuel_per_100 || 0).toFixed(1)} л/100км` },
          { label: 'Себестоимость', value: null, raw: `${(d.cost_per_km || 0).toFixed(2)}`, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', sub: `доход ${(d.revenue_per_km || 0).toFixed(2)} Br/км` },
        ].map(kpi => (
          <div key={kpi.label} className="card" onClick={kpi.onClick} style={{ padding: '18px 20px', cursor: kpi.onClick ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{kpi.label}</div>
            <div style={{
              fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 30, color: kpi.color,
              background: kpi.bg, borderRadius: 12, padding: '8px 14px', display: 'inline-block', lineHeight: 1,
            }}>{kpi.value != null ? <CountUp value={kpi.value} /> : kpi.raw}</div>
            {kpi.sub && <div style={{ fontSize: 11.5, color: '#8A93A0', marginTop: 6 }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* По рейсам */}
      <div className="card" style={{ padding: '18px 20px', overflow: 'hidden' }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 12 }}>По рейсам</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#A6AEB8' }}>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Рейс</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Статус</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Выручка</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Расходы</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Прибыль</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Рент.</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 && <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#A6AEB8' }}>Рейсов пока нет</td></tr>}
              {trips.map(t => (
                <tr key={t.id} onClick={() => onOpenTrip?.(t.id)} style={{ borderTop: '1px solid #F0F1F4', cursor: onOpenTrip ? 'pointer' : 'default' }}>
                  <td style={{ padding: '9px 10px', color: '#0E1726' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#1366F0', marginRight: 6 }}>Р{t.trip_number || 0}</span>
                    {t.name || t.route || '—'}
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: stColor(t.status), background: `${stColor(t.status)}1a`, borderRadius: 99, padding: '2px 8px' }}>{stLabel(t.status)}</span>
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#0E1726' }}>{int(t.revenue)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#E0473B' }}>{int(t.expenses)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: t.profit >= 0 ? '#1E9E5A' : '#E0473B' }}>{int(t.profit)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#8A93A0' }}>{t.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Просрочка оплаты + долги водителям */}
      {((d.overdue && d.overdue.length > 0) || (d.driver_debts && d.driver_debts.length > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {d.overdue && d.overdue.length > 0 && (
            <div className="card" style={{ padding: '18px 20px', border: '1px solid rgba(200,25,35,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#C81923', fontWeight: 700, letterSpacing: '0.1em' }}>ПРОСРОЧКА ОПЛАТЫ</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#C81923' }}>{int(d.overdue_total)} Br</div>
              </div>
              {d.overdue.map((o, i) => (
                <div key={o.order_id || i}
                  onClick={() => o.client_id && onOpenClient?.(o.client_id)}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < d.overdue.length - 1 ? '1px solid #F0F1F4' : 'none', fontSize: 12.5, cursor: o.client_id ? 'pointer' : 'default' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#1366F0', marginRight: 6 }}>{o.order_number}</span>{o.client_name}
                  </span>
                  <span style={{ flexShrink: 0, color: '#C81923', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {int(o.amount)} · +{o.days}д
                  </span>
                </div>
              ))}
            </div>
          )}
          {d.driver_debts && d.driver_debts.length > 0 && (
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 700, letterSpacing: '0.1em' }}>ДОЛГ ВОДИТЕЛЯМ</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#D97706' }}>{int(d.driver_debt_total)} Br</div>
              </div>
              {d.driver_debts.map((dr, i) => (
                <div key={dr.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < d.driver_debts.length - 1 ? '1px solid #F0F1F4' : 'none', fontSize: 13 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dr.name}</span>
                  <span style={{ flexShrink: 0, color: '#D97706', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{int(dr.sum)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Должники + Топ клиентов */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {[['ДОЛЖНИКИ', d.debtors, '#D97706'], ['ТОП КЛИЕНТОВ', d.top_clients, '#1E9E5A']].map(([title, items, accent]) => (
          <div key={title} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 10 }}>{title}</div>
            {(!items || items.length === 0) ? (
              <div style={{ fontSize: 12.5, color: '#8A93A0' }}>нет</div>
            ) : items.map((it, i) => (
              <div key={i}
                onClick={() => it.id && onOpenClient?.(it.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0',
                  borderBottom: i < items.length - 1 ? '1px solid #F0F1F4' : 'none', fontSize: 13, color: '#0E1726',
                  cursor: it.id ? 'pointer' : 'default',
                }}
                onPointerEnter={mouseOnly(e => { if (it.id) e.currentTarget.style.background = 'rgba(19,102,240,0.05)' })}
                onPointerLeave={mouseOnly(e => { e.currentTarget.style.background = 'transparent' })}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name || '—'}</span>
                <span style={{ fontWeight: 700, flexShrink: 0, color: accent, fontFamily: 'var(--font-mono)' }}>{int(it.sum)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
