import type { Context } from "@netlify/functions";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getNetlifyDbUser } from "../../server/netlify/identity";
import { netlifyAppRouter } from "../../server/netlify/router";

export default async (request: Request, _context: Context) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: netlifyAppRouter,
    createContext: async () => ({
      req: request as never,
      res: { clearCookie: () => undefined } as never,
      user: await getNetlifyDbUser(),
    }),
  });

export const config = { path: ["/api/trpc", "/api/trpc/*"] };

