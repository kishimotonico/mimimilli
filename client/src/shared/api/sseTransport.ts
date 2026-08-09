import type { z } from "zod";

export interface SseConnection {
  readonly source: EventSource;
  close(): void;
}

export function connectSse(url: string): SseConnection {
  const source = new EventSource(url);
  return {
    source,
    close: () => {
      source.close();
    },
  };
}

export interface SseEventValidationMessages {
  parse: string;
  schema: string;
}

export type SseParseResult<TEvent> = { ok: true; event: TEvent } | { ok: false; message: string };

export function parseTypedSseMessage<TEvent>(
  data: string,
  schema: z.ZodType<TEvent>,
  messages: SseEventValidationMessages,
): SseParseResult<TEvent> {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { ok: false, message: messages.parse };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, message: messages.schema };
  }
  return { ok: true, event: parsed.data };
}

export interface BindTypedSseEventsOptions<TEvent> {
  source: EventSource;
  eventNames: readonly string[];
  schema: z.ZodType<TEvent>;
  messages: SseEventValidationMessages;
  onValidatedEvent: (event: TEvent) => void;
  onValidationFailure: (message: string) => void;
}

export function bindTypedSseEvents<TEvent>(options: BindTypedSseEventsOptions<TEvent>): () => void {
  const handle = (raw: Event): void => {
    if (!(raw instanceof MessageEvent) || typeof raw.data !== "string") return;
    const parsed = parseTypedSseMessage(raw.data, options.schema, options.messages);
    if (!parsed.ok) {
      options.onValidationFailure(parsed.message);
      return;
    }
    options.onValidatedEvent(parsed.event);
  };

  for (const type of options.eventNames) {
    options.source.addEventListener(type, handle);
  }

  return () => {
    for (const type of options.eventNames) {
      options.source.removeEventListener(type, handle);
    }
  };
}

export interface BindSseTransportErrorOptions {
  source: EventSource;
  onConnectionError: () => void;
  onNamedErrorEvent?: (event: MessageEvent<string>) => void;
}

export function bindSseTransportError(options: BindSseTransportErrorOptions): () => void {
  const handler = (event: Event): void => {
    if (event instanceof MessageEvent && typeof event.data === "string") {
      options.onNamedErrorEvent?.(event);
      return;
    }
    options.onConnectionError();
  };

  if (options.onNamedErrorEvent) {
    options.source.addEventListener("error", handler);
    return () => {
      options.source.removeEventListener("error", handler);
    };
  }

  const previousOnError = options.source.onerror;
  options.source.onerror = handler;
  return () => {
    if (options.source.onerror === handler) {
      options.source.onerror = previousOnError;
    }
  };
}

export interface SseGeneration {
  current(): number;
  bump(): number;
  isCurrent(token: number): boolean;
}

export function createSseGeneration(): SseGeneration {
  let generation = 0;
  return {
    current: () => generation,
    bump: () => ++generation,
    isCurrent: (token) => token === generation,
  };
}
