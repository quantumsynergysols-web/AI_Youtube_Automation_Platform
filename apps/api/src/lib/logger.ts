import pino from 'pino'
import { env, isProd } from '../config/env'

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProd ? undefined : { target: 'pino/file', options: { destination: 1 } },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    remove: true,
  },
})
