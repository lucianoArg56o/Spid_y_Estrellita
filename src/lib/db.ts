import pg from "pg";

const raw = typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl = raw && raw.trim() ? raw.trim() : undefined;

if (!databaseUrl && typeof process !== "undefined" && process.env.NODE_ENV === "production") {
  console.error("[db] DATABASE_URL is required in production");
}

export type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

let pool: pg.Pool | null = null;

function getPool() {
  if (!databaseUrl) throw new Error("DATABASE_URL no configurada");
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

function normalize(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "bigint") out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

export async function getSql(): Promise<Sql> {
  const p = getPool();
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = "";
    const params: unknown[] = [];
    strings.forEach((s, i) => {
      text += s;
      if (i < values.length) {
        params.push(values[i]);
        text += `$${params.length}`;
      }
    });
    const res = await p.query(text, params);
    return res.rows.map(normalize) as T[];
  }) as Sql;

  sql.query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const res = await p.query(text, params);
    return res.rows.map(normalize) as T[];
  };
  return sql;
}
