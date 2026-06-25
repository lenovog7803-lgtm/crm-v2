import React, { useState } from 'react'

const PAGE_META = {
  dashboard: { title: 'Дашборд', subtitle: 'Обзор бизнеса' },
  orders: { title: 'Заявки', subtitle: 'Управление грузоперевозками' },
  'order-detail': { title: 'Заявка', subtitle: 'Детали перевозки' },
  finance: { title: 'Финансы', subtitle: 'Платежи и расчёты' },
  tasks: { title: 'Задачи', subtitle: 'Текущие дела и напоминания' },
  clients: { title: 'Клиенты', subtitle: 'База клиентов' },
  'client-detail': { title: 'Клиент', subtitle: 'Карточка клиента' },
  carriers: { title: 'Перевозчики', subtitle: 'База перевозчиков' },
  'carrier-detail': { title: 'Перевозчик', subtitle: 'Карточка перевозчика' },
  leads: { title: 'База обзвона', subtitle: 'Лиды и потенциальные клиенты' },
}

const PERIOD_OPTIONS = [
  { label: 'Текущий месяц', id: 'month' },
  { label: 'Прошлый месяц', id: 'last_month' },
  { label: 'Квартал', id: 'quarter' },
  { label: 'Год', id: 'year' },
  { label: 'Всё время', id: 'all' },
]

const MONTH_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const fmtMonth = m => {
  if (!m) return m
  const [y, mo] = m.split('-')
  return `${MONTH_RU[parseInt(mo) - 1]} ${y}`
}

export default function Topbar({ page, onSignOut, period = 'month', onPeriodChange, availableMonths = [] }) {
  const [search, setSearch] = useState('')
  const meta = PAGE_META[page] || { title: page, subtitle: '' }

  const fixedIds = new Set(['month', 'last_month', 'quarter', 'year', 'all'])
  const extraMonths = availableMonths.filter(m => !fixedIds.has(m))

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 20px',
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 18,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px -8px rgba(20,30,55,0.12)',
      marginBottom: 0,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 18, color: '#0E1726', letterSpacing: '-0.02em' }}>{meta.title}</div>
        <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 1 }}>{meta.subtitle}</div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: 300 }}>
        <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#A6AEB8' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск..."
          style={{
            width: '100%', paddingLeft: 34, paddingRight: 12,
            height: 38, borderRadius: 11,
            border: '1px solid rgba(14,23,38,0.12)',
            background: 'rgba(255,255,255,0.7)',
            fontFamily: 'Manrope', fontSize: 13.5, color: '#0E1726',
            outline: 'none',
          }}
        />
      </div>

      {/* Period — only on dashboard */}
      {page === 'dashboard' && (
        <select
          value={period}
          onChange={e => onPeriodChange && onPeriodChange(e.target.value)}
          style={{
            height: 38, padding: '0 12px', borderRadius: 11,
            border: '1px solid rgba(14,23,38,0.12)',
            background: 'rgba(255,255,255,0.7)',
            fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, color: '#0E1726',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {PERIOD_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          {extraMonths.length > 0 && <option disabled>──────────</option>}
          {extraMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
        </select>
      )}

      {/* Bell */}
      <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#5A6573', padding: 6, borderRadius: 10 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span style={{
          position: 'absolute', top: 5, right: 5,
          width: 8, height: 8, borderRadius: '50%', background: '#C81923',
          border: '2px solid #fff',
        }} />
      </button>

      {/* Sign out */}
      {onSignOut && (
        <button onClick={onSignOut} title="Выйти" style={{
          background: 'rgba(14,23,38,0.06)', border: 'none', cursor: 'pointer',
          color: '#8A93A0', padding: 8, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      )}
    </div>
  )
}
