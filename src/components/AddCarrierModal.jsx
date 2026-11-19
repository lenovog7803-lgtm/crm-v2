import { useState, useRef } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createCarrier, findDuplicates, lookupCompany } from '../api'
import Select from './Select'
import { iosConfirm, confirmNoDuplicates } from './IOSAlert'
import { findBankByAccount, findBankByBik, parseRequisites, formatPhone, formatIBAN } from '../utils'

const sectionLabel = {
  fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)',
  marginBottom: 2,
}

export default function AddCarrierModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    company_name: '', contact_person: '', driver_name: '', phone: '', unp: '',
    director: '', basis: 'Устава',
    address: '', postal_address: '',
    bank: '', rs: '', bik: '',
    capacity_tons: '', vehicle_type: '', plate: '', regions: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [rawText, setRawText] = useState('')
  const [parseMsg, setParseMsg] = useState('')
  const [unpStatus, setUnpStatus] = useState(null)
  const unpTimer = useRef(null)

  const checkUnp = (unpVal) => {
    const clean = String(unpVal).replace(/\D/g, '')
    if (unpTimer.current) clearTimeout(unpTimer.current)
    if (clean.length === 9 || clean.length === 10) {
      setUnpStatus({ loading: true })
      unpTimer.current = setTimeout(async () => {
        try {
          const res = await lookupCompany(clean)
          if (res?.ok) {
            setUnpStatus({
              ok: true,
              status: res.status,
              name: res.name,
              is_active: res.is_active,
              country: res.country,
              reg_date: res.reg_date,
              age_text: res.age_text,
              risk_level: res.risk_level || (res.is_active ? 'good' : 'critical'),
              risk_badge: res.risk_badge || (res.is_active ? 'Реестр МНС' : 'Ликвидация'),
              risk_message: res.risk_message,
              mns_name: res.mns_name,
            })
            setForm(f => ({
              ...f,
              company_name: res.name || f.company_name,
              address: res.address || f.address,
            }))
          } else {
            setUnpStatus({ ok: false, error: res?.error || 'Не найдено в реестре' })
          }
        } catch (err) {
          console.error(err)
          setUnpStatus({ ok: false, error: 'Сбой запроса' })
        }
      }, 350)
    } else {
      setUnpStatus(null)
    }
  }

  const set = (k, v) => {
    setIsDirty(true)
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'rs') {
        const d = findBankByAccount(v)
        if (d) {
          next.bik = d.bik
          next.bank = d.bank
        }
      } else if (k === 'bik') {
        const d = findBankByBik(v)
        if (d) {
          next.bank = d.bank
        }
      }
      return next
    })
    if (k === 'unp') checkUnp(v)
  }

  const handleApplyRawText = () => {
    if (!rawText.trim()) return
    const parsed = parseRequisites(rawText, 'carrier')
    let count = 0
    setForm(f => {
      const next = { ...f }
      if (parsed.name) { next.company_name = parsed.name; count++ }
      if (parsed.unp) { next.unp = parsed.unp; count++; checkUnp(parsed.unp) }
      if (parsed.account) { next.rs = parsed.account; count++ }
      if (parsed.bik) { next.bik = parsed.bik; count++ }
      if (parsed.bank) { next.bank = parsed.bank; count++ }
      if (parsed.director) { next.director = parsed.director; count++ }
      if (parsed.basis) { next.basis = parsed.basis; count++ }
      if (parsed.legal_address) { next.address = parsed.legal_address; count++ }
      if (parsed.postal_address) { next.postal_address = parsed.postal_address; count++ }
      if (parsed.contact_person) {
        next.contact_person = parsed.contact_person
        next.driver_name = parsed.contact_person
        count++
      } else if (parsed.driver_name && !next.contact_person) {
        next.contact_person = parsed.driver_name
        next.driver_name = parsed.driver_name
        count++
      }
      if (parsed.contact_phone) {
        next.phone = parsed.contact_phone
        count++
      } else if (parsed.phone) {
        next.phone = parsed.phone
        count++
      }
      if (parsed.plate) { next.plate = parsed.plate; count++ }
      if (parsed.vehicle_type) { next.vehicle_type = parsed.vehicle_type; count++ }
      if (parsed.capacity_tons) { next.capacity_tons = parsed.capacity_tons; count++ }
      return next
    })
    setIsDirty(true)
    setParseMsg(`✓ Распознано и заполнено ${count} полей`)
    setTimeout(() => {
      setPasteOpen(false)
      setRawText('')
      setParseMsg('')
    }, 1200)
  }

  const handleClose = async () => {
    if (isDirty && !(await iosConfirm('Вы уверены? Изменения не сохранятся.'))) return
    onClose()
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.company_name) return
    setLoading(true)
    setError('')
    if (!(await confirmNoDuplicates(() => findDuplicates('carriers', { phone: form.phone, name: form.company_name, unp: form.unp }), 'такой перевозчик'))) { setLoading(false); return }
    try {
      await createCarrier({
        ...form,
        contact_person: form.contact_person || form.driver_name || '',
        driver_name: form.contact_person || form.driver_name || '',
        capacity_tons: form.capacity_tons ? parseFloat(form.capacity_tons) : 0,
        rating: 5.0,
      })
      setIsDirty(false)
      onSuccess()
    } catch (e) {
      setError(e?.message || 'Ошибка при сохранении')
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={handleClose}>
      <ModalHeader title="Добавить перевозчика" onClose={handleClose} />

      {/* Apple-style умная вставка реквизитов */}
      <div style={{ marginBottom: 14 }}>
        {!pasteOpen ? (
          <div
            onClick={() => setPasteOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(var(--rgb-19-102-240), 0.08) 0%, rgba(var(--rgb-19-102-240), 0.02) 100%)',
              border: '0.5px solid rgba(var(--rgb-19-102-240), 0.22)',
              boxShadow: '0 2px 8px -2px rgba(var(--rgb-19-102-240), 0.08)',
              cursor: 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'rgba(var(--rgb-19-102-240), 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fg-1366f0)',
                flexShrink: 0,
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                  Умная вставка реквизитов
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Распознает компанию, УНП, банк, счёт, контакты и авто
                </span>
              </div>
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 9999,
              background: 'rgba(var(--rgb-19-102-240), 0.12)',
              color: 'var(--fg-1366f0)',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}>
              Вставить
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </span>
          </div>
        ) : (
          <div
            className="ios-form-group"
            style={{
              padding: 14,
              background: 'linear-gradient(180deg, rgba(var(--paper-rgb), 0.95) 0%, rgba(var(--paper-rgb), 0.8) 100%)',
              border: '0.5px solid rgba(var(--rgb-19-102-240), 0.3)',
              boxShadow: '0 8px 24px -6px rgba(var(--rgb-19-102-240), 0.15)',
              borderRadius: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#007AFF',
                  boxShadow: '0 0 8px #007AFF',
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                  Быстрое распознавание текста
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(var(--sep-rgb), 0.15)',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            </div>
            <textarea
              className="form-input"
              rows={4}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Вставьте сюда реквизиты перевозчика (ООО, УНП, адрес, счёт, банк, тягач, водитель, телефон, паспорт)..."
              style={{
                width: '100%',
                resize: 'vertical',
                fontSize: 12,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                borderRadius: 12,
              }}
              autoFocus
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{
                fontSize: 12,
                color: '#30D158',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}>
                {parseMsg && (
                  <>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158' }} />
                    {parseMsg}
                  </>
                )}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setPasteOpen(false); setRawText(''); }}
                  style={{ padding: '6px 12px', fontSize: 12, borderRadius: 10 }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleApplyRawText}
                  disabled={!rawText.trim()}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    borderRadius: 10,
                    fontWeight: 600,
                  }}
                >
                  Распознать и заполнить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Основное */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Основное</div>
          <div className="form-field">
            <label className="form-label">Наименование</label>
            <input className="form-input" placeholder="ИП Иванов / ООО «ТрансЛайн»" value={form.company_name} onChange={e => set('company_name', e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">Контактное лицо</label>
              <input
                className="form-input"
                placeholder="Фамилия И.О. / Менеджер"
                value={form.contact_person ?? form.driver_name ?? ''}
                onChange={e => {
                  set('contact_person', e.target.value)
                  set('driver_name', e.target.value)
                }}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Телефон контактного лица</label>
              <input
                className="form-input"
                placeholder="+375 29 000-00-00"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                onBlur={() => set('phone', formatPhone(form.phone))}
              />
            </div>
          </div>
        </div>

        {/* Реквизиты */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Реквизиты компании</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div className="form-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">УНП</label>
                {unpStatus?.loading && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
                    background: 'rgba(0, 122, 255, 0.1)', color: '#0A84FF',
                    border: '0.5px solid rgba(0, 122, 255, 0.25)',
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0A84FF' }} />
                    проверка...
                  </span>
                )}
                {unpStatus?.ok && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
                    background: unpStatus.risk_level === 'critical' ? 'rgba(255, 69, 58, 0.12)' : unpStatus.risk_level === 'warning' ? 'rgba(255, 159, 10, 0.12)' : 'rgba(48, 209, 88, 0.12)',
                    color: unpStatus.risk_level === 'critical' ? '#FF453A' : unpStatus.risk_level === 'warning' ? '#FF9F0A' : '#30D158',
                    border: `0.5px solid ${unpStatus.risk_level === 'critical' ? 'rgba(255, 69, 58, 0.28)' : unpStatus.risk_level === 'warning' ? 'rgba(255, 159, 10, 0.28)' : 'rgba(48, 209, 88, 0.28)'}`,
                  }} title={unpStatus.risk_message || unpStatus.status}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: unpStatus.risk_level === 'critical' ? '#FF453A' : unpStatus.risk_level === 'warning' ? '#FF9F0A' : '#30D158',
                      boxShadow: `0 0 6px ${unpStatus.risk_level === 'critical' ? 'rgba(255, 69, 58, 0.6)' : unpStatus.risk_level === 'warning' ? 'rgba(255, 159, 10, 0.6)' : 'rgba(48, 209, 88, 0.6)'}`,
                    }} />
                    {unpStatus.risk_badge || (unpStatus.is_active ? 'Реестр МНС' : 'Ликвидация')}
                  </span>
                )}
                {unpStatus && !unpStatus.loading && !unpStatus.ok && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
                    background: 'rgba(152, 152, 157, 0.12)', color: '#8E8E93',
                    border: '0.5px solid rgba(152, 152, 157, 0.22)',
                  }} title={unpStatus.error}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#8E8E93' }} />
                    Вне реестра (ИП / вручную)
                  </span>
                )}
              </div>
              <input className="form-input" placeholder="100000000" value={form.unp} onChange={e => set('unp', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Основание</label>
              <Select className="form-input" value={form.basis} onChange={e => set('basis', e.target.value)}>
                <option value="Устава">Устава</option>
                <option value="Свидетельства о гос. регистрации">Свидетельства о гос. регистрации</option>
              </Select>
            </div>
          </div>
          {unpStatus?.risk_message && unpStatus?.risk_level !== 'good' && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 12,
              background: unpStatus.risk_level === 'critical' ? 'rgba(255, 69, 58, 0.10)' : 'rgba(255, 159, 10, 0.08)',
              border: `1px solid ${unpStatus.risk_level === 'critical' ? 'rgba(255, 69, 58, 0.25)' : 'rgba(255, 159, 10, 0.22)'}`,
              color: unpStatus.risk_level === 'critical' ? '#FF453A' : '#FF9F0A',
              fontSize: 12, lineHeight: 1.45, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>{unpStatus.risk_level === 'critical' ? '⚠️' : 'ℹ️'}</span>
              <span>{unpStatus.risk_message}</span>
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Директор</label>
            <input className="form-input" placeholder="Иванов Иван Иванович" value={form.director} onChange={e => set('director', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Юридический адрес</label>
            <input className="form-input" placeholder="220000, г. Минск, ул. Ленина, д. 1" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Почтовый адрес</label>
            <input className="form-input" placeholder="220000, г. Минск, ул. Ленина, д. 1" value={form.postal_address} onChange={e => set('postal_address', e.target.value)} />
          </div>
        </div>

        {/* Банковские реквизиты */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Банковские реквизиты</div>
          <div className="form-field">
            <label className="form-label">Расчётный счёт (IBAN)</label>
            <input
              className="form-input"
              placeholder="BY12 BAPB 3012 1234 5678 9000 0000"
              value={form.rs}
              onChange={e => set('rs', e.target.value)}
              onBlur={() => set('rs', formatIBAN(form.rs))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">БИК</label>
              <input className="form-input" placeholder="BAPBBY2X" value={form.bik} onChange={e => set('bik', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Банк</label>
              <input className="form-input" placeholder="ОАО «Белагропромбанк»" value={form.bank} onChange={e => set('bank', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ТС */}
        <div className="ios-form-group">
          <div style={sectionLabel}>Транспорт</div>
          <div className="form-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Тип ТС (данные авто, водителя, паспорт, тел.)</label>
              {form.vehicle_type && (
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {form.vehicle_type.split('\n').filter(Boolean).length} стр.
                </span>
              )}
            </div>
            <textarea
              className="form-input"
              rows={6}
              placeholder="Авто: Газель-NEXT / прицеп&#10;Гос. номер: АТ 8824-7&#10;Водитель: Козлов Олег Васильевич&#10;Паспорт: МС3511246&#10;Выдан Минским РУВД Минской области 12.02.2023&#10;+375447766008"
              value={form.vehicle_type}
              onChange={e => set('vehicle_type', e.target.value)}
              style={{
                width: '100%',
                resize: 'vertical',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                borderRadius: 14,
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">Номер ТС</label>
              <input className="form-input" placeholder="АВ 1234-7 / АА 5678-7" value={form.plate} onChange={e => set('plate', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Грузоподъёмность (т)</label>
              <input className="form-input" type="number" placeholder="20" value={form.capacity_tons} onChange={e => set('capacity_tons', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Регионы работы</label>
              <input className="form-input" placeholder="РБ, РФ, ЕС" value={form.regions} onChange={e => set('regions', e.target.value)} />
            </div>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--fg-c81923)', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" className="btn-ghost" onClick={handleClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Сохранение...' : 'Добавить перевозчика'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}