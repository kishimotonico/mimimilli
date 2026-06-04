import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { mockHandlers } from "./handlers";
import { createMockState } from "./state";

export function mockApiPlugin(): Plugin {
  const state = createMockState();

  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use(
        "/api",
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url ?? "/";
          const context = {
            req,
            res,
            url,
            urlPath: url.split("?")[0],
            method: req.method ?? "GET",
            state,
          };

          for (const handler of mockHandlers) {
            if (await handler(context)) return;
          }

          next();
        },
      );
    },
  };
}
