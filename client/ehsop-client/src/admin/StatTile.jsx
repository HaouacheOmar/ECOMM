// A figure with its change since the previous month. The change carries an arrow and words,
// so its colour (good / bad / neutral) is never the only signal.
export default function StatTile({ label, value, delta, previousLabel, help, flag, to }) {
  return (
    <div className="card p-3 h-100 stat-tile">
      <div className="small text-body-secondary">{label}</div>
      <div className="stat-value">{value}</div>
      {delta && <div className={`small stat-delta stat-${delta.tone}`}>{delta.text} <span className="text-body-secondary">vs {previousLabel}</span></div>}
      {flag && <div className="small mt-1"><span className="badge-out">{flag}</span></div>}
      {help && <div className="small text-body-secondary mt-1">{help}</div>}
      {to}
    </div>
  )
}
