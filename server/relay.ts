// The relay: signalling and TURN credentials. Realizes design/surfaces/relay.html.
// Scaffold only: /health answers, /turn says TURN is not configured, /signal is not built yet.
import { createServer } from "node:http";

const port = Number(process.env.RELAY_PORT ?? 8787);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://relay");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ signal: false, turn: false }));
  } else if (url.pathname === "/turn") {
    res.writeHead(503).end();
  } else {
    res.writeHead(404).end();
  }
});

server.listen(port, () => console.log(`relay on :${port}`));
