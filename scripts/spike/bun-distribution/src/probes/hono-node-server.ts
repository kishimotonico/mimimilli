import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono().get("/", (context) => context.text("ok"));
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });

try {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to obtain ephemeral server port");
  }
  const response = await fetch(`http://127.0.0.1:${address.port}`);
  if ((await response.text()) !== "ok") {
    throw new Error("unexpected @hono/node-server response");
  }
  console.log("@hono/node-server runtime probe: ok");
} finally {
  server.close();
}
