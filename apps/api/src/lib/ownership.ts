import { prisma } from './prisma'
import { notFound } from './errors'

/**
 * Never trust a project id from the URL.
 *
 * Reports "no such project" for someone else's id rather than 403, so the
 * endpoint does not confirm that the project exists to a stranger holding a
 * guessed id.
 *
 * Shared rather than copied per route file: a check that appears in two places
 * is a check where one copy eventually gets fixed and the other does not.
 */
export async function assertOwnsProject(userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!project || project.userId !== userId) throw notFound('No such project.')
}
