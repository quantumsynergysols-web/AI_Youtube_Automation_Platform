export interface ApiError {
  code: string
  message: string
  details?: { field: string; message: string }[]
}

export class ApiFailure extends Error {
  readonly status: number
  readonly error: ApiError

  constructor(status: number, error: ApiError) {
    super(error.message)
    this.status = status
    this.error = error
  }
}

export function actionErrorMessage(error: unknown, fallback: string, guidance: string): string {
  const reason = error instanceof ApiFailure ? error.error.message : fallback
  return `${reason} ${guidance}`
}
