// A labelled input with its error shown (and announced) right under it.
export default function Field({ id, label, error, ...input }) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} className={`form-control${error ? ' is-invalid' : ''}`} aria-describedby={error ? `${id}-error` : undefined} {...input} />
      {error && <div id={`${id}-error`} className="text-danger small mt-1">{error}</div>}
    </div>
  )
}
