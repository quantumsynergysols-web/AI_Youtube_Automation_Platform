import type { NextFunction, Request, Response } from 'express'
import { consumeAllowance } from '../modules/billing/billing.service'

/**
 * FR-12.2. Consumes allowance before any paid provider is called, so an
 * out-of-quota account never incurs cost.
 */
export function requireAllowance(opts: { allowOverage?: boolean } = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await consumeAllowance(req.user!.sub, opts.allowOverage ?? false)
      next()
    } catch (err) {
      next(err)
    }
  }
}
