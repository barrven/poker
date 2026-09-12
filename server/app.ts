import http from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { pingDb } from "./db.js";

export function createApp(db: DatabaseSync): http.Server {
  return http.createServer((req, res) => {
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
}
