interface Props {
  label: string
  /** Sits under the input, so a rule stays attached to the field it governs. */
  hint?: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
}

export function Field({ label, hint, type = 'text', value, onChange, autoComplete, required }: Props) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
