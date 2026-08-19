interface Props {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
}

export function Field({ label, type = 'text', value, onChange, autoComplete, required }: Props) {
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
    </label>
  )
}
