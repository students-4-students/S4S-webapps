import { All, Controller, Next, Req, Res } from '@nestjs/common'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { appRouter } from '../routers'
import { createContext } from './context'
import type { NextFunction, Request, Response } from 'express'

const trpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext,
})

@Controller('trpc')
export class TrpcController {
  @All('*splat')
  handle(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return trpcMiddleware(req, res, next)
  }
}
