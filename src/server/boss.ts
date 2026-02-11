import PgBoss from "pg-boss";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const boss = new PgBoss({
  connectionString,
  schema: "pgboss"
});

let started = false;

export async function ensureBoss() {
  if (started) return;
  await boss.start();
  started = true;
}
