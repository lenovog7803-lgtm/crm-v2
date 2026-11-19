import { useState, useEffect } from 'react'
import { getClient, deleteClient as apiDelete, updateClient, getOrders, lookupCompany } from '../api'
import { initials, statusLabel, statusColor, statusBg, getGradient, findBankByAccount, findBankByBik, formatPhone, formatIBAN } from '../utils'
import { mouseOnly } from '../motion'
import { Loader } from './Loader'
import { StatusOrb } from './StatusOrb'
import Select from './Select'
import { iosError } from './IOSAlert'
import { EmptyState } from './EmptyState'

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '8px 0', borderBottom: '1px solid rgba(var(--ink-rgb), 0.05)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'right', fontFamily: mono ? 'var(--font-mono)' : undefined, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  )
}

const iStyle = {
  width: '100%', height: 34, padding: '0 10px', fontSize: 13, borderRadius: 10,
  border: '1px solid rgba(var(--ink-rgb), 0.14)', background: 'rgba(var(--paper-rgb), 0.8)',
  fontFamily: 'var(--font-sys)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
}

function EditField({ label, value, onChange, onBlur, mono, type = 'text' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(var(--ink-rgb), 0.05)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0, minWidth: 90 }}>{label}</span>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        style={{ ...iStyle, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sys)', fontSize: mono ? 12 : 13 }}
      />
    </div>
  )
}

function EditSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(var(--ink-rgb), 0.05)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0, minWidth: 90 }}>{label}</span>
      <Select value={value || ''} onChange={e => onChange(e.target.value)} style={iStyle}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </Select>
    </div>
  )
}

export default function ClientDetail({ clientId, onMeta, onBack, onDelete, onOpenOrder }) {
  const [client, setClient] = useState(null)
  useEffect(() => {
    if (!client) return
    const inn = client.inn || client.unp
    onMeta?.({ title: client.name || 'Клиент', subtitle: [client.contact_person || client.contact, client.city, inn && `УНП ${inn}`].filter(Boolean).join(' · ') || 'Карточка клиента' })
  }, [client?.name, client?.contact_person, client?.contact, client?.city, client?.inn, client?.unp])  // eslint-disable-line react-hooks/exhaustive-deps
  const [clientOrders, setClientOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [unpVerification, setUnpVerification] = useState(null)

  useEffect(() => {
    const unp = client?.unp || client?.inn
    if (!unp) return
    const clean = String(unp).replace(/\D/g, '')
    if (clean.length === 9 || clean.length === 10) {
      lookupCompany(clean).then(res => {
        if (res?.ok) setUnpVerification(res)
      }).catch(() => {})
    }
  }, [client?.unp, client?.inn])

  const handleCopyRequisites = () => {
    if (!client) return
    const parts = [
      client.name,
      client.unp ? `УНП: ${client.unp}` : '',
      client.bank_account ? `Р/С: ${client.bank_account}` : '',
      client.bank_bik ? `БИК: ${client.bank_bik}${client.bank_name ? ` (${client.bank_name})` : ''}` : '',
      client.legal_address ? `Юр. адрес: ${client.legal_address}` : '',
      client.phone ? `Тел: ${client.phone}` : '',
      client.email ? `Email: ${client.email}` : '',
    ].filter(Boolean)
    navigator.clipboard?.writeText(parts.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    Promise.all([
      getClient(clientId),
      getOrders({ client_id: clientId }).catch(() => getOrders()),
    ]).then(([c, orders]) => {
      setClient(c)
      const arr = Array.isArray(orders) ? orders : []
      setClientOrders(arr.filter(o => o.client_id === clientId || String(o.client_id) === String(clientId)))
    }).catch(console.error).finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <Loader padding={60} />
  if (!client) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Клиент не найден</div>

  const [avA, avB] = getGradient(client.name || '')

  const startEdit = () => {
    setForm({
      name: client.name || '',
      contact_person: client.contact_person || '',
      phone: client.phone || '',
      email: client.email || '',
      unp: client.unp || client.inn || '',
      director: client.director || '',
      basis: client.basis || 'Устава',
      legal_address: client.legal_address || '',
      postal_address: client.postal_address || '',
      payment_terms: client.payment_terms || '',
      bank_name: client.bank_name || '',
      bank_account: client.bank_account || '',
      bank_bik: client.bank_bik || '',
      notes: client.notes || '',
    })
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    setSaving(true)
    try {
      const updated = await updateClient(client.id, form)
      setClient(updated || { ...client, ...form })
      setEditing(false)
    } catch (err) { console.error(err); iosError('Изменения не сохранились. Проверьте интернет и попробуйте ещё раз.') }
    setSaving(false)
  }

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    if (k === 'bank_account') {
      const d = findBankByAccount(v)
      if (d) { next.bank_bik = d.bik; next.bank_name = d.bank }
    } else if (k === 'bank_bik') {
      const d = findBankByBik(v)
      if (d) { next.bank_name = d.bank }
    }
    return next
  })

  const handleDelete = async () => {
    try { await apiDelete(client.id) } catch (err) { console.error(err); iosError('Клиент не удалён. Проверьте интернет и попробуйте ещё раз.'); return }
    onDelete(client.id)
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-ghost" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Клиенты
        </button>
        <div style={{ flex: 1 }} />
        {editing ? (
          <>
            <button onClick={cancelEdit} className="btn-ghost">
              Отмена
            </button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        ) : (
          <>
            <button onClick={startEdit} className="btn-ghost" style={{ color: 'var(--fg-1366f0)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Редактировать
            </button>
            <button onClick={handleDelete} className="btn-ghost" style={{ color: 'var(--fg-c81923)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
              Удалить клиента
            </button>
          </>
        )}
      </div>

      {unpVerification?.risk_level === 'critical' && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 14,
          background: 'rgba(255, 69, 58, 0.12)', border: '1px solid rgba(255, 69, 58, 0.3)',
          color: '#FF453A', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Внимание: контрагент в стадии ликвидации или банкротства!</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{unpVerification.risk_message}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22, margin: '0 auto 16px',
          '--av-hue': avB, background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 24,
          boxShadow: `0 12px 30px -12px color-mix(in srgb, ${avB} 50%, transparent)`,
        }}>{initials(editing ? form.name : client.name)}</div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Наименование" style={{ ...iStyle, textAlign: 'center', fontWeight: 700, fontSize: 17 }} />
            <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Контактное лицо" style={{ ...iStyle, textAlign: 'center' }} />
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              onBlur={() => set('phone', formatPhone(form.phone))}
              placeholder="Телефон"
              style={{ ...iStyle, textAlign: 'center' }}
            />
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{client.name}</div>
            {client.contact_person && <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>{client.contact_person}</div>}
            {client.phone && (
              <a href={`tel:${client.phone}`} style={{ display: 'block', marginTop: 8, fontSize: 15, fontWeight: 600, color: 'var(--fg-1366f0)', textDecoration: 'none' }}>{client.phone}</a>
            )}
          </>
        )}
      </div>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>РЕКВИЗИТЫ</div>
          {editing ? (
            <>
              <EditField label="УНП" value={form.unp} onChange={v => set('unp', v)} mono />
              <EditField label="Директор" value={form.director} onChange={v => set('director', v)} />
              <EditSelect label="Основание" value={form.basis} onChange={v => set('basis', v)} options={['Устава', 'Свидетельства о гос. регистрации']} />
              <EditField label="Юр. адрес" value={form.legal_address} onChange={v => set('legal_address', v)} />
              <EditField label="Почт. адрес" value={form.postal_address} onChange={v => set('postal_address', v)} />
              <EditField label="Условия оплаты" value={form.payment_terms} onChange={v => set('payment_terms', v)} />
              <EditField label="Email" value={form.email} onChange={v => set('email', v)} />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '8px 0', borderBottom: '1px solid rgba(var(--ink-rgb), 0.05)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>УНП</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{client.unp || client.inn || '—'}</span>
                  {unpVerification?.ok && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '1.5px 7px', borderRadius: 9999, fontSize: 10.5, fontWeight: 600,
                      background: unpVerification.risk_level === 'critical' ? 'rgba(255, 69, 58, 0.12)' : unpVerification.risk_level === 'warning' ? 'rgba(255, 159, 10, 0.12)' : 'rgba(48, 209, 88, 0.12)',
                      color: unpVerification.risk_level === 'critical' ? '#FF453A' : unpVerification.risk_level === 'warning' ? '#FF9F0A' : '#30D158',
                      border: `0.5px solid ${unpVerification.risk_level === 'critical' ? 'rgba(255, 69, 58, 0.28)' : unpVerification.risk_level === 'warning' ? 'rgba(255, 159, 10, 0.28)' : 'rgba(48, 209, 88, 0.28)'}`,
                    }} title={unpVerification.risk_message}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                      {unpVerification.risk_badge}
                    </span>
                  )}
                </div>
              </div>
              {client.director && <Row label="Директор" value={client.director} />}
              {client.basis && <Row label="Основание" value={client.basis} />}
              <Row label="Юр. адрес" value={client.legal_address} />
              {client.postal_address && <Row label="Почт. адрес" value={client.postal_address} />}
              <Row label="Условия оплаты" value={client.payment_terms} />
            </>
          )}
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="section-label">БАНКОВСКИЕ РЕКВИЗИТЫ</div>
            {!editing && (
              <button
                type="button"
                onClick={handleCopyRequisites}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 9999,
                  background: copied ? 'rgba(48, 209, 88, 0.12)' : 'rgba(var(--rgb-19-102-240), 0.08)',
                  color: copied ? '#30D158' : 'var(--fg-1366f0)',
                  border: copied ? '0.5px solid rgba(48, 209, 88, 0.28)' : '0.5px solid rgba(var(--rgb-19-102-240), 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {copied ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </>
                  )}
                </svg>
                <span>{copied ? 'Скопировано' : 'Скопировать'}</span>
              </button>
            )}
          </div>
          {editing ? (
            <>
              <EditField
                label="Р/С (IBAN)"
                value={form.bank_account}
                onChange={v => set('bank_account', v)}
                onBlur={() => set('bank_account', formatIBAN(form.bank_account))}
                mono
              />
              <EditField label="БИК" value={form.bank_bik} onChange={v => set('bank_bik', v)} mono />
              <EditField label="Банк" value={form.bank_name} onChange={v => set('bank_name', v)} />
            </>
          ) : (
            <>
              <Row label="Банк" value={client.bank_name} />
              <Row label="Счёт" value={client.bank_account} mono />
              <Row label="БИК" value={client.bank_bik} mono />
            </>
          )}
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>ДОПОЛНИТЕЛЬНО</div>
          {editing ? (
            <EditField label="Примечания" value={form.notes} onChange={v => set('notes', v)} />
          ) : (
            <>
              {client.email && <Row label="Email" value={client.email} />}
              {client.kpp && <Row label="КПП" value={client.kpp} mono />}
              {client.notes && <Row label="Примечания" value={client.notes} />}
            </>
          )}
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>ИСТОРИЯ ЗАЯВОК</div>
          {clientOrders.length === 0 ? (
            <EmptyState compact title="Заявок пока нет" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {clientOrders.slice(0, 15).map(o => (
                <div
                  key={o.id}
                  onClick={() => onOpenOrder && onOpenOrder(o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 10px', borderRadius: 10,
                    borderBottom: '1px solid rgba(var(--ink-rgb), 0.05)',
                    cursor: onOpenOrder ? 'pointer' : 'default',
                    transition: 'background 0.12s',
                  }}
                  onPointerEnter={mouseOnly(e => { if (onOpenOrder) e.currentTarget.style.background = 'rgba(var(--rgb-19-102-240), 0.05)' })}
                  onPointerLeave={mouseOnly(e => e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-1366f0)', fontWeight: 600 }}>{o.order_number || o.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.route_from && o.route_to ? `${o.route_from} → ${o.route_to}` : '—'}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', flexShrink: 0 }}>
                    {(o.client_rate || 0).toLocaleString('ru-RU')} Br
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                    background: statusBg(o.status), color: statusColor(o.status),
                    fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}><StatusOrb status={o.status} scale={0.7} />{statusLabel(o.status)}</span>
                  {onOpenOrder && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
