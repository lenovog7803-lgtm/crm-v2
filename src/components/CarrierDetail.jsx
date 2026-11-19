import { useState, useEffect } from 'react'
import { getCarrier, deleteCarrier as apiDelete, updateCarrier, getOrders, lookupCompany } from '../api'
import { statusLabel, statusColor, statusBg, getGradient, findBankByAccount, findBankByBik, formatPhone, formatIBAN } from '../utils'
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

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--fg-d97706)" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
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

export default function CarrierDetail({ carrierId, onMeta, onBack, onDelete, onOpenOrder }) {
  const [carrier, setCarrier] = useState(null)
  useEffect(() => {
    if (!carrier) return
    const cap = carrier.capacity_tons ? carrier.capacity_tons + ' т' : carrier.cap
    onMeta?.({ title: carrier.company_name || carrier.name || 'Перевозчик', subtitle: [carrier.contact_person || carrier.driver_name || carrier.driver, cap, carrier.vehicle_type, carrier.plate].filter(Boolean).join(' · ') || 'Карточка перевозчика' })
  }, [carrier?.company_name, carrier?.name, carrier?.contact_person, carrier?.driver_name, carrier?.driver, carrier?.capacity_tons, carrier?.cap, carrier?.vehicle_type, carrier?.plate])  // eslint-disable-line react-hooks/exhaustive-deps
  const [carrierOrders, setCarrierOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [unpVerification, setUnpVerification] = useState(null)

  useEffect(() => {
    const unp = carrier?.unp || carrier?.inn
    if (!unp) return
    const clean = String(unp).replace(/\D/g, '')
    if (clean.length === 9 || clean.length === 10) {
      lookupCompany(clean).then(res => {
        if (res?.ok) setUnpVerification(res)
      }).catch(() => {})
    }
  }, [carrier?.unp, carrier?.inn])

  const handleCopyRequisites = () => {
    if (!carrier) return
    const parts = [
      carrier.company_name || carrier.name,
      carrier.unp ? `УНП: ${carrier.unp}` : '',
      carrier.rs || carrier.bank_account ? `Р/С: ${carrier.rs || carrier.bank_account}` : '',
      (carrier.bik || carrier.bank_bik) ? `БИК: ${carrier.bik || carrier.bank_bik}${carrier.bank ? ` (${carrier.bank})` : ''}` : '',
      carrier.address || carrier.legal_address ? `Юр. адрес: ${carrier.address || carrier.legal_address}` : '',
      (carrier.contact_person || carrier.driver_name) ? `Контакт: ${carrier.contact_person || carrier.driver_name}` : '',
      carrier.vehicle_type ? `ТС / Водитель: ${carrier.vehicle_type}` : (carrier.plate ? `ТС: ${carrier.plate}` : ''),
      carrier.phone ? `Тел: ${carrier.phone}` : '',
    ].filter(Boolean)
    navigator.clipboard?.writeText(parts.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (!carrierId) return
    setLoading(true)
    Promise.all([
      getCarrier(carrierId),
      getOrders({ carrier_id: carrierId }).catch(() => getOrders()),
    ]).then(([c, orders]) => {
      setCarrier(c)
      const arr = Array.isArray(orders) ? orders : []
      setCarrierOrders(arr.filter(o => o.carrier_id === carrierId || String(o.carrier_id) === String(carrierId)))
    }).catch(console.error).finally(() => setLoading(false))
  }, [carrierId])

  if (loading) return <Loader padding={60} />
  if (!carrier) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Перевозчик не найден</div>

  const name = carrier.company_name || carrier.name || '—'
  const driver = carrier.contact_person || carrier.driver_name || carrier.driver || ''
  const cap = carrier.capacity_tons ? carrier.capacity_tons + ' т' : '—'
  const [avA, avB] = getGradient(name)

  const startEdit = () => {
    setForm({
      company_name: carrier.company_name || '',
      contact_person: carrier.contact_person || carrier.driver_name || '',
      driver_name: carrier.driver_name || carrier.contact_person || '',
      phone: carrier.phone || '',
      unp: carrier.unp || carrier.inn || '',
      director: carrier.director || '',
      basis: carrier.basis || 'Устава',
      address: carrier.address || carrier.legal_address || '',
      postal_address: carrier.postal_address || '',
      bank: carrier.bank || carrier.bank_name || '',
      rs: carrier.rs || carrier.bank_account || '',
      bik: carrier.bik || carrier.bank_bik || carrier.bank_bic || '',
      vehicle_type: carrier.vehicle_type || '',
      plate: carrier.plate || '',
      capacity_tons: carrier.capacity_tons || '',
      regions: carrier.regions || '',
      cargo_types: carrier.cargo_types || '',
    })
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    setSaving(true)
    try {
      const updated = await updateCarrier(carrier.id, {
        ...form,
        contact_person: form.contact_person || form.driver_name || '',
        driver_name: form.contact_person || form.driver_name || '',
        capacity_tons: form.capacity_tons ? parseFloat(form.capacity_tons) : 0,
      })
      setCarrier(updated || { ...carrier, ...form })
      setEditing(false)
    } catch (err) { console.error(err); iosError('Изменения не сохранились. Проверьте интернет и попробуйте ещё раз.') }
    setSaving(false)
  }

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    if (k === 'rs') {
      const d = findBankByAccount(v)
      if (d) { next.bik = d.bik; next.bank = d.bank }
    } else if (k === 'bik') {
      const d = findBankByBik(v)
      if (d) { next.bank = d.bank }
    }
    return next
  })

  const handleDelete = async () => {
    try { await apiDelete(carrier.id) } catch (err) { console.error(err); iosError('Перевозчик не удалён. Проверьте интернет и попробуйте ещё раз.'); return }
    onDelete(carrier.id)
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-ghost" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Перевозчики
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
              Удалить
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
          boxShadow: `0 12px 30px -12px color-mix(in srgb, ${avB} 50%, transparent)`,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="1"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Наименование" style={{ ...iStyle, textAlign: 'center', fontWeight: 700, fontSize: 17 }} />
            <input value={form.driver_name} onChange={e => set('driver_name', e.target.value)} placeholder="Водитель" style={{ ...iStyle, textAlign: 'center' }} />
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
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{name}</div>
            <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>{driver}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              <StarIcon />
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-d97706)' }}>{carrier.rating || '5.0'}</span>
            </div>
            {carrier.phone && (
              <a href={`tel:${carrier.phone}`} style={{ display: 'block', marginTop: 8, fontSize: 15, fontWeight: 600, color: 'var(--fg-1366f0)', textDecoration: 'none' }}>{carrier.phone}</a>
            )}
          </>
        )}
      </div>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>ИНФОРМАЦИЯ</div>
          {editing ? (
            <>
              <EditField label="Контакт" value={form.contact_person || form.driver_name} onChange={v => { set('contact_person', v); set('driver_name', v); }} />
              <EditField label="УНП" value={form.unp} onChange={v => set('unp', v)} mono />
              <EditField label="Директор" value={form.director} onChange={v => set('director', v)} />
              <EditSelect label="Основание" value={form.basis} onChange={v => set('basis', v)} options={['Устава', 'Свидетельства о гос. регистрации']} />
              <EditField label="Юр. адрес" value={form.address} onChange={v => set('address', v)} />
              <EditField label="Почт. адрес" value={form.postal_address} onChange={v => set('postal_address', v)} />
              <EditField label="Груз. (т)" value={form.capacity_tons} onChange={v => set('capacity_tons', v)} type="number" />
              <EditField label="Тип ТС" value={form.vehicle_type} onChange={v => set('vehicle_type', v)} />
              <EditField label="Номер ТС" value={form.plate} onChange={v => set('plate', v)} mono />
              <EditField label="Регионы" value={form.regions} onChange={v => set('regions', v)} />
              <EditField label="Груз" value={form.cargo_types} onChange={v => set('cargo_types', v)} />
            </>
          ) : (
            <>
              <Row label="Контакт" value={carrier.contact_person || carrier.driver_name} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '8px 0', borderBottom: '1px solid rgba(var(--ink-rgb), 0.05)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>УНП</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{carrier.unp || carrier.inn || '—'}</span>
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
              <Row label="Директор" value={carrier.director} />
              <Row label="Основание" value={carrier.basis} />
              <Row label="Юр. адрес" value={carrier.address || carrier.legal_address} />
              <Row label="Почтовый адрес" value={carrier.postal_address} />
              <Row label="Грузоподъёмность" value={cap} />
              <Row label="Тип ТС" value={carrier.vehicle_type} />
              <Row label="Номер ТС" value={carrier.plate && !/^\d+\.?\d*$/.test(carrier.plate) ? carrier.plate : null} mono />
              <Row label="Регионы" value={carrier.regions} />
              <Row label="Груз" value={carrier.cargo_types} />
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
                value={form.rs}
                onChange={v => set('rs', v)}
                onBlur={() => set('rs', formatIBAN(form.rs))}
                mono
              />
              <EditField label="БИК" value={form.bik} onChange={v => set('bik', v)} mono />
              <EditField label="Банк" value={form.bank} onChange={v => set('bank', v)} />
            </>
          ) : (
            <>
              <Row label="Банк" value={carrier.bank || carrier.bank_name} />
              <Row label="Р/С" value={carrier.rs || carrier.bank_account} mono />
              <Row label="БИК" value={carrier.bik || carrier.bank_bik || carrier.bank_bic} mono />
              {carrier.email && <Row label="Email" value={carrier.email} />}
              {carrier.notes && <Row label="Примечания" value={carrier.notes} />}
            </>
          )}
        </div>

        {/* Carrier order history */}
        <div className="card" style={{ padding: '20px 22px', gridColumn: '1 / -1' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>ИСТОРИЯ ЗАЯВОК</div>
          {carrierOrders.length === 0 ? (
            <EmptyState compact title="Заявок пока нет" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {carrierOrders.slice(0, 15).map(o => (
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
                    {(o.carrier_rate || 0).toLocaleString('ru-RU')} Br
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
