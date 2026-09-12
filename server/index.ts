import http from "node:http";
import { openDb, pingDb } from "./db.js";

const db = openDb();

const port = Number(process.env.PORT ?? 3001);

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const pathOnly = url.split("?")[0] ?? "/";

  if (req.method === "GET" && pathOnly === "/api/health") {
    const dbOk = pingDb(db);
    const status = dbOk ? 200 : 503;
    const body = JSON.stringify({ ok: dbOk, db: dbOk ? "ok" : "error" });
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`API http://127.0.0.1:${port}/api/health`);
});
