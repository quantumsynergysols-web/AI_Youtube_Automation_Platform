import { ApiFailure } from '../lib/api'

export function Alert({ error, message }: { error?: unknown; message?: string | null }) {
  if (message) return <div className="alert ok">{message}</div>
  if (!error) return null

  if (error instanceof ApiFailure) {
    return (
      <div className="alert error">
        <div>{error.error.message}</div>
        {error.error.details?.length ? (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {error.error.details.map((d) => (
              <li key={d.field}>{d.field}: {d.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }
  return <div className="alert error">{String(error)}</div>
}
