import { useState, useEffect, useMemo, Fragment } from 'react'
import {
  getAllUsers, createManager, updateManager, deleteManager,
  getSessions, forceLogoutSession,
  getManagerStats, getManagerStatsDetail,
} from '../api'
import { useToast } from '../components/Toast'
import { ModalOverlay, ModalHeader } from '../components/Modal'
import { CallsHeatmap, FunnelChart } from '../components/leads/AnalyticsView'

const TABS = [
  { id: 'managers', label: 'Пользователи' },
  { id: 'sessions', label: 'Сессии' },
  { id: 'stats', label: 'Статистика' },
]

const ROLE_LABEL = { admin: 'Директор', director: 'Директор', manager: 'Менеджер' }

// The user doc has a few more permission keys (can_view_finance,
// can_view_all_clients, can_create_orders) left over from an earlier design
// — only these two are actually checked anywhere in the backend today, so
// those are the only toggles offered here. Showing switches that don't do
// anything would be worse than not showing them.
const PERMISSION_OPTIONS = [
  { key: 'can_view_all_leads', label: 'Видит все лиды, а не только свои и общий пул' },
  { key: 'can_view_all_orders', label: 'Видит все заявки, а не только свои и общий пул' },
]

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(14,23,38,0.12)', background: '#F7F8FA',
  fontSize: 13, fontFamily: 'Manrope', color: '#0E1726', boxSizing: 'border-box',
}

function parseDeviceInfo(ua) {
  if (!ua) return 'Неизвестное устройство'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Браузер'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'ОС'
  return `${browser} · ${os}`
}

function relativeTime(iso) {
  if (!iso) return '—'
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  const hrs = Math.floor(diffMin / 60)
  if (hrs < 24) return `${hrs} ч назад`
  return `${Math.floor(hrs / 24)} дн назад`
}

function UserDetailModal({ user, onClose, onSaved }) {
  const { show } = useToast()
  const [login, setLogin] = useState(user.login)
  const [name, setName] = useState(user.name)
  const [password, setPassword] = useState('')
  const [perms, setPerms] = useState(user.permissions || {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const togglePerm = (key) => setPerms(p => ({ ...p, [key]: !p[key] }))

  const handleSave = async () => {
    if (!login.trim() || !name.trim()) return
    setSaving(true)
    setError('')
    try {
      const payload = { login: login.trim(), name: name.trim(), permissions: perms }
      if (password.trim()) payload.password = password.trim()
      const updated = await updateManager(user.id, payload)
      show(`${updated.name || name}: изменения сохранены`, { type: 'success' })
      onSaved(updated)
      onClose()
    } catch (e) {
      setError(e.message || 'Ошибка сохранения')
    }
    setSaving(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={`Пользователь: ${user.login}`} onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: user.role === 'manager' ? 'rgba(19,102,240,0.1)' : 'rgba(124,58,237,0.1)',
            color: user.role === 'manager' ? '#1366F0' : '#7C3AED',
          }}>{ROLE_LABEL[user.role] || user.role}</span>
          <span style={{ fontSize: 11.5, color: '#A6AEB8' }}>роль меняется отдельно, не через эту форму</span>
        </div>

        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>ЛОГИН</div>
          <input style={inputStyle} value={login} onChange={e => setLogin(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>ИМЯ</div>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>НОВЫЙ ПАРОЛЬ</div>
          <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} placeholder="Оставьте пустым, чтобы не менять" autoComplete="new-password" />
          <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 5, lineHeight: 1.4 }}>
            Текущий пароль хранится хешированным и нигде не может быть показан — можно только задать новый.
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 8 }}>ПРАВА ДОСТУПА</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PERMISSION_OPTIONS.map(p => (
              <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#0E1726', background: perms[p.key] ? 'rgba(19,102,240,0.06)' : 'transparent' }}>
                <input type="checkbox" checked={!!perms[p.key]} onChange={() => togglePerm(p.key)} style={{ width: 15, height: 15, accentColor: '#1366F0' }} />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 13, border: '1px solid rgba(14,23,38,0.12)', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope', fontSize: 14, fontWeight: 600, color: '#5A6573' }}>Отмена</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

function UsersTab() {
  const { show } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ login: '', password: '', name: '', daily_call_goal: 45 })
  const [creating, setCreating] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const load = () => {
    setLoading(true)
    getAllUsers().then(r => setUsers(r.users || r || [])).catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' })).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.login || !form.password || !form.name) return
    setCreating(true)
    try {
      await createManager({ ...form, daily_call_goal: Number(form.daily_call_goal) || 45 })
      show('Менеджер создан', { type: 'success' })
      setForm({ login: '', password: '', name: '', daily_call_goal: 45 })
      load()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setCreating(false)
  }

  const toggleStatus = async (m) => {
    const next = m.status === 'suspended' ? 'active' : 'suspended'
    try {
      await updateManager(m.id, { status: next })
      setUsers(prev => prev.map(x => x.id === m.id ? { ...x, status: next } : x))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const changeGoal = async (m, value) => {
    const goal = Number(value)
    if (!goal || goal === m.daily_call_goal) return
    try {
      await updateManager(m.id, { daily_call_goal: goal })
      setUsers(prev => prev.map(x => x.id === m.id ? { ...x, daily_call_goal: goal } : x))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const remove = async (m) => {
    if (!window.confirm(`Удалить пользователя «${m.name}» (${m.login})? Это действие нельзя отменить.`)) return
    try {
      await deleteManager(m.id)
      setUsers(prev => prev.filter(x => x.id !== m.id))
      show('Пользователь удалён', { type: 'info' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form onSubmit={handleCreate} className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 10, alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>ЛОГИН</div>
          <input style={inputStyle} value={form.login} onChange={e => set('login', e.target.value)} placeholder="ivan_m" required />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>ВРЕМЕННЫЙ ПАРОЛЬ</div>
          <input style={inputStyle} value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" required />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>ИМЯ</div>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Иван Менеджеров" required />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>ПЛАН ЗВОНКОВ/ДЕНЬ</div>
          <input type="number" style={inputStyle} value={form.daily_call_goal} onChange={e => set('daily_call_goal', e.target.value)} min={1} />
        </div>
        <button type="submit" disabled={creating} className="btn-primary" style={{ height: 40, whiteSpace: 'nowrap' }}>
          {creating ? 'Создаю…' : '+ Менеджер'}
        </button>
      </form>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Пользователей пока нет</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Логин', 'Имя', 'Роль', 'Статус', 'План звонков/день', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(m => {
                const isManager = m.role === 'manager'
                return (
                  <tr key={m.id} onClick={() => setEditUser(m)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '11px 14px', fontSize: 13, fontFamily: 'JetBrains Mono', color: '#1366F0', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.login}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#0E1726', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.name}</td>
                    <td style={{ padding: '11px 14px', borderTop: '1px solid rgba(14,23,38,0.05)' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: isManager ? 'rgba(19,102,240,0.1)' : 'rgba(124,58,237,0.1)',
                        color: isManager ? '#1366F0' : '#7C3AED',
                      }}>{ROLE_LABEL[m.role] || m.role}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: '1px solid rgba(14,23,38,0.05)' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleStatus(m)} style={{
                        padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        fontSize: 11.5, fontWeight: 700,
                        background: m.status === 'suspended' ? 'rgba(224,71,59,0.1)' : 'rgba(30,158,90,0.1)',
                        color: m.status === 'suspended' ? '#E0473B' : '#1E9E5A',
                      }}>
                        {m.status === 'suspended' ? 'Заблокирован' : 'Активен'}
                      </button>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: '1px solid rgba(14,23,38,0.05)' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        defaultValue={m.daily_call_goal || 45}
                        onBlur={e => changeGoal(m, e.target.value)}
                        style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(14,23,38,0.12)', fontSize: 12.5, fontFamily: 'JetBrains Mono' }}
                      />
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: '1px solid rgba(14,23,38,0.05)', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {isManager && (
                        <button onClick={() => remove(m)} style={{ padding: '6px 12px', borderRadius: 9, border: 'none', background: 'rgba(200,25,35,0.08)', color: '#C81923', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editUser && (
        <UserDetailModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={updated => setUsers(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x))}
        />
      )}
    </div>
  )
}

function SessionsTab() {
  const { show } = useToast()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getSessions().then(r => setSessions(r.sessions || [])).catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' })).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const logout = async (s) => {
    try {
      await forceLogoutSession(s.id)
      setSessions(prev => prev.filter(x => x.id !== s.id))
      show('Сессия завершена', { type: 'info' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>
  if (sessions.length === 0) return <div className="card" style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Активных сессий нет</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sessions.map(s => (
        <div key={s.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1726' }}>{s.user_login} · <span style={{ fontWeight: 500, color: '#5A6573' }}>{ROLE_LABEL[s.role] || s.role}</span></div>
            <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>{parseDeviceInfo(s.device_info)} · {s.ip || '—'}</div>
          </div>
          <div style={{ fontSize: 12, color: '#5A6573', textAlign: 'right', flexShrink: 0 }}>
            <div>{relativeTime(s.last_activity)}</div>
            <div style={{ color: '#A6AEB8', marginTop: 2 }}>{s.activity_summary?.calls ?? 0} звонков · {s.activity_summary?.won ?? 0} в клиенты</div>
          </div>
          <button onClick={() => logout(s)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(224,71,59,0.3)', background: 'rgba(224,71,59,0.06)', color: '#E0473B', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            Завершить сессию
          </button>
        </div>
      ))}
    </div>
  )
}

const STAT_PERIODS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Всё время' },
]

function ManagerDetail({ manager, period }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getManagerStatsDetail(manager.id, period === 'today' ? 'week' : period).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [manager.id, period])

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>
  if (!data) return <div style={{ padding: 24, textAlign: 'center', color: '#A6AEB8' }}>Нет данных</div>

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CallsHeatmap data={data.calls_by_day || []} onDayClick={() => {}} />
      <div>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Воронка конверсий</div>
        <FunnelChart funnel={data.funnel} />
      </div>
    </div>
  )
}

function StatsTab() {
  const { show } = useToast()
  const [period, setPeriod] = useState('today')
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    setLoading(true)
    getManagerStats(period).then(r => setManagers(r.managers || [])).catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' })).finally(() => setLoading(false))
  }, [period])

  const sorted = useMemo(() => [...managers].sort((a, b) => b.conversion - a.conversion), [managers])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '10px 12px', display: 'flex', gap: 6, width: 'fit-content' }}>
        {STAT_PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: period === p.id ? '#0E1726' : 'rgba(14,23,38,0.06)',
            color: period === p.id ? '#fff' : '#5A6573',
          }}>{p.label}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Менеджеров пока нет</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Менеджер', 'Звонков', ...(period === 'today' ? ['% плана'] : []), 'Лидов в работе', 'Конверсия', 'Просрочки'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <Fragment key={m.id}>
                  <tr onClick={() => setOpenId(openId === m.id ? null : m.id)} style={{ cursor: 'pointer', background: openId === m.id ? 'rgba(19,102,240,0.04)' : undefined }}>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#0E1726', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.name}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.calls}</td>
                    {period === 'today' && (
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: (m.goal_pct ?? 0) >= 100 ? '#1E9E5A' : '#0E1726', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.goal_pct ?? 0}%</td>
                    )}
                    <td style={{ padding: '11px 14px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.leads_in_work}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#1E9E5A', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.conversion}%</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: m.overdue > 0 ? 700 : 400, color: m.overdue > 0 ? '#E0473B' : '#5A6573', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{m.overdue}</td>
                  </tr>
                  {openId === m.id && (
                    <tr>
                      <td colSpan={period === 'today' ? 6 : 5} style={{ padding: 0, borderTop: '1px solid rgba(14,23,38,0.05)' }}>
                        <ManagerDetail manager={m} period={period} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function Admin() {
  const [tab, setTab] = useState('managers')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 6 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 15px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: tab === t.id ? '#0E1726' : 'rgba(14,23,38,0.06)',
            color: tab === t.id ? '#fff' : '#5A6573',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'managers' && <UsersTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}
