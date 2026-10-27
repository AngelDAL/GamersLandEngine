// Debe ir ANTES que cualquier otro import: define globalThis.AsyncLocalStorage.
// Sin esto, la cadena de imports de next-auth/jwt (vía src/socket/server) evalúa
// módulos de app-render de Next antes de que exista el ALS y truena el arranque
// con "Invariant: AsyncLocalStorage accessed in runtime where it is not available".
import "next/dist/server/node-environment";
import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./src/socket/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  initSocketServer(httpServer);

  httpServer.listen(port, "127.0.0.1", () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
