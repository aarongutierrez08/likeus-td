import { createServer } from "node:http";
import { createGameServer } from "./server";

const PORT = Number.parseInt(process.env["PORT"] ?? "2567", 10);

createGameServer(createServer())
  .listen(PORT)
  .then(() => console.log(`td server listening on ws://localhost:${PORT}`))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
