import { PrismaClient } from '@prisma/client'
import { isProd } from '../config/env'

// A single client per process. tsx watch reloads the module graph, so cache it
// on globalThis to avoid exhausting the connection pool during development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: isProd ? ['warn', 'error'] : ['warn', 'error'] })

if (!isProd) globalForPrisma.prisma = prisma
