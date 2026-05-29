import type { IncomingMessage, ServerResponse } from "node:http";
import type { MockState } from "../state";

export interface MockHandlerContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: string;
  urlPath: string;
  method: string;
  state: MockState;
}

export type MockHandler = (context: MockHandlerContext) => boolean | Promise<boolean>;
