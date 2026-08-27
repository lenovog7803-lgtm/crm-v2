import { useState, useEffect } from 'react'
import { getBotSubscription, subscribeBot } from '../api'
import { useToast } from './Toast'

// Telegram chat_id entry for the "А2 Инфо СРМ" bot. Shown on the hidden
// Reports page (directors) and on the Tasks page (so managers, who get
// payment-reminder pings, can subscribe without an admin doing it for them).
export default function BotSubscribeSection() {
  const [chatId, setChatId] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    getBotSubscription().then(r => {
      setSubscribed(r.subscribed)
      if (r.chat_id) setChatId(r.chat_id)
    }).catch(() => {})
  }, [])

  const save = async () => {
    if (!chatId.trim()) return
    setSaving(true)
    try {
      await subscribeBot(chatId.trim())
      setSubscribed(true)
      show('Подписка на бота А2 Инфо СРМ включена', { type: 'success' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setSaving(false)
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid rgba(14,23,38,0.06)' }}>
      <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726', marginBottom: 4 }}>
        Telegram-бот А2 Инфо СРМ
      </div>
      <div style={{ fontSize: 12, color: '#8A93A0', marginBottom: 14 }}>
        Напишите /start боту <b>@a2info_bot</b> в Telegram, узнайте свой chat_id и впишите ниже.
        {subscribed && <span style={{ color: '#1E9E5A' }}> Сейчас подключено.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={chatId}
          onChange={e => setChatId(e.target.value)}
          placeholder="Например 558556324"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E8EAEE', fontSize: 13 }}
        />
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: '10px 18px', borderRadius: 10, background: '#1366F0', color: '#fff', border: 'none', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {subscribed ? 'Обновить' : 'Подключить'}
        </button>
      </div>
    </div>
  )
}
