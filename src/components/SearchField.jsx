// Строка поиска как в iOS: серая капсула, лупа слева, ✕ справа, когда что-то введено.
export default function SearchField({ value, onChange, placeholder = 'Поиск', style, autoFocus }) {
  return (
    <label className="ios-search" style={style}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <input data-plain value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} />
      {value && (
        <button type="button" className="ios-search-clear" onClick={() => onChange('')} aria-label="Очистить">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" />
            <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}
    </label>
  )
}
