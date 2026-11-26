export default function LeadDisclosure({ title, count, className = '', children }) {
  return <details className={`lead-disclosure ${className}`}>
    <summary>
      <span>{title}{count > 0 && <small>{count}</small>}</span>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m4 6 4 4 4-4" />
      </svg>
    </summary>
    {children}
  </details>
}
