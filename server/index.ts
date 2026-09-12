import { createApp } from "./app.js";
import { openDb } from "./db.js";

const db = openDb();
const port = Number(process.env.PORT ?? 3001);
const server = createApp(db);

server.listen(port, "127.0.0.1", () => {
  console.log(`API http://127.0.0.1:${port}/api/health`);
});
