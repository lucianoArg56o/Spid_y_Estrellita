import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import {
  coerceKind,
  coerceOwner,
  coercePersona,
  type Balance,
  type Item,
  type ItemInput,
  type Kind,
  type MemberState,
  type Owner,
  type Persona,
  type Result,
} from "@/lib/nido/model";

type MemberRow = {
  user_id: string;
  household_id: string;
  persona: Owner;
  display_name: string;
};

type ItemRow = {
  id: string;
  kind: Kind;
  persona: Persona;
  categoria: string;
  titulo: string;
  monto: string | number;
  fecha: string | Date;
  pagado: boolean;
  carrito: boolean;
  reloj: boolean;
  cuenta: boolean;
  fuente_id: string | null;
  mes_ref: string | null;
  pagado_at: string | Date | null;
  created_by: string;
  updated_at: string | Date;
};

function asIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asDate(value: unknown) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value ?? "").slice(0, 10);
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    kind: row.kind,
    persona: row.persona,
    categoria: row.categoria,
    titulo: row.titulo,
    monto: num(row.monto),
    fecha: asDate(row.fecha),
    pagado: Boolean(row.pagado),
    carrito: Boolean(row.carrito),
    reloj: Boolean(row.reloj),
    cuenta: row.cuenta !== false,
    fuenteId: row.fuente_id || null,
    mesRef: row.mes_ref,
    pagadoAt: asIso(row.pagado_at),
    createdBy: row.created_by,
    updatedAt: asIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function loadState(sql: Sql, userId: string): Promise<MemberState | { status: "guest" }> {
  const meRows = await sql<MemberRow>`
    select user_id, household_id, persona, display_name
    from members where user_id = ${userId}
  `;
  const me = meRows[0];
  if (!me) return { status: "guest" };

  const house = (
    await sql<{ id: string; name: string; invite_code: string }>`
      select id, name, invite_code from households where id = ${me.household_id}
    `
  )[0];
  if (!house) return { status: "guest" };

  const members = await sql<MemberRow>`
    select user_id, household_id, persona, display_name
    from members where household_id = ${house.id}
  `;
  const balances = await sql<{
    persona: Owner;
    sueldo: string | number;
    sueldo_set: boolean;
    disponible: string | number;
    disponible_set: boolean;
    disponible_at: string | Date | null;
  }>`
    select persona, sueldo, sueldo_set, disponible, disponible_set, disponible_at
    from balances where household_id = ${house.id}
  `;
  const items = await sql<ItemRow>`
    select id, kind, persona, categoria, titulo, monto, fecha, pagado, carrito, reloj,
           cuenta, fuente_id, mes_ref, pagado_at, created_by, updated_at
    from items where household_id = ${house.id}
    order by fecha desc, updated_at desc
  `;

  return {
    status: "member",
    household: { id: house.id, name: house.name, inviteCode: house.invite_code },
    me: { persona: me.persona, displayName: me.display_name, userId: me.user_id },
    members: members.map((m) => ({ persona: m.persona, displayName: m.display_name })),
    balances: balances.map(
      (b): Balance => ({
        persona: b.persona,
        sueldo: num(b.sueldo),
        sueldoSet: Boolean(b.sueldo_set),
        disponible: num(b.disponible),
        disponibleSet: Boolean(b.disponible_set),
        disponibleAt: asIso(b.disponible_at),
      }),
    ),
    items: items.map(mapItem),
    serverTime: new Date().toISOString(),
  };
}

function ok(state: MemberState): Result {
  return { ok: true, state };
}
function fail(error: string): Result {
  return { ok: false, error };
}

/** Identidad que manda el cliente (localStorage). Confianza = 2 usuarios conocidos. */
type Who = { userId: string; displayName?: string };

export const getState = createServerFn({ method: "GET" })
  .validator((input: Who) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    return loadState(sql, data.userId);
  });

export const createHousehold = createServerFn({ method: "POST" })
  .validator((input: Who & { persona: string; name?: string; displayName?: string }) => input)
  .handler(async ({ data }): Promise<Result> => {
    const persona = coerceOwner(data.persona);
    if (!persona) return fail("Elegí Spidy o Estrella");
    if (!data.userId) return fail("Falta perfil local");

    const sql = await getSql();
    const existing = await loadState(sql, data.userId);
    if (existing.status === "member") return ok(existing);

    const id = crypto.randomUUID();
    const invite = code();
    const houseName = (data.name || "Nuestra caja").slice(0, 80);
    const display = (data.displayName || data.persona).slice(0, 40);

    await sql`
      insert into households (id, name, invite_code) values (${id}, ${houseName}, ${invite})
    `;
    await sql`
      insert into members (user_id, household_id, persona, display_name)
      values (${data.userId}, ${id}, ${persona}, ${display})
    `;
    await sql`insert into balances (household_id, persona) values (${id}, ${"spidy"})`;
    await sql`insert into balances (household_id, persona) values (${id}, ${"estrella"})`;

    const state = await loadState(sql, data.userId);
    return state.status === "member" ? ok(state) : fail("No se pudo crear");
  });

export const joinHousehold = createServerFn({ method: "POST" })
  .validator((input: Who & { inviteCode: string; displayName?: string }) => input)
  .handler(async ({ data }): Promise<Result> => {
    if (!data.userId) return fail("Falta perfil local");
    const codeIn = String(data.inviteCode || "")
      .trim()
      .toUpperCase();
    if (codeIn.length < 4) return fail("Código inválido");

    const sql = await getSql();
    const existing = await loadState(sql, data.userId);
    if (existing.status === "member") return ok(existing);

    const house = (
      await sql<{ id: string }>`
        select id from households where invite_code = ${codeIn}
      `
    )[0];
    if (!house) return fail("Código no encontrado");

    const members = await sql<{ persona: Owner }>`
      select persona from members where household_id = ${house.id}
    `;
    if (members.length >= 2) return fail("Esta caja ya tiene a las dos personas");
    const taken = new Set(members.map((m) => m.persona));
    const persona: Owner | null = !taken.has("spidy")
      ? "spidy"
      : !taken.has("estrella")
        ? "estrella"
        : null;
    if (!persona) return fail("No queda lugar libre");

    const display = (data.displayName || persona).slice(0, 40);
    await sql`
      insert into members (user_id, household_id, persona, display_name)
      values (${data.userId}, ${house.id}, ${persona}, ${display})
    `;

    const state = await loadState(sql, data.userId);
    return state.status === "member" ? ok(state) : fail("No se pudo unir");
  });

export const setMoney = createServerFn({ method: "POST" })
  .validator(
    (input: Who & { persona: string; field: "sueldo" | "disponible"; amount: number }) => input,
  )
  .handler(async ({ data }): Promise<Result> => {
    const persona = coerceOwner(data.persona);
    if (!persona) return fail("Persona inválida");
    const sql = await getSql();
    const me = await loadState(sql, data.userId);
    if (me.status !== "member") return fail("No sos miembro");

    const amount = Math.max(0, Number(data.amount) || 0);
    if (data.field === "sueldo") {
      await sql`
        update balances set sueldo = ${amount}, sueldo_set = true, updated_at = now()
        where household_id = ${me.household.id} and persona = ${persona}
      `;
    } else {
      await sql`
        update balances set disponible = ${amount}, disponible_set = true,
          disponible_at = now(), updated_at = now()
        where household_id = ${me.household.id} and persona = ${persona}
      `;
    }
    const state = await loadState(sql, data.userId);
    return state.status === "member" ? ok(state) : fail("Error");
  });

export const saveItem = createServerFn({ method: "POST" })
  .validator((input: Who & { item: ItemInput }) => input)
  .handler(async ({ data }): Promise<Result> => {
    const sql = await getSql();
    const me = await loadState(sql, data.userId);
    if (me.status !== "member") return fail("No sos miembro");

    const it = data.item;
    const kind = coerceKind(it.kind);
    const persona = coercePersona(it.persona);
    if (!kind || !persona) return fail("Datos inválidos");
    const id = it.id || crypto.randomUUID();
    const monto = Math.max(0, Number(it.monto) || 0);
    const fecha = String(it.fecha || "").slice(0, 10);
    const titulo = String(it.titulo || "").slice(0, 120);
    const categoria = String(it.categoria || "otro").slice(0, 40);

    await sql`
      insert into items (
        id, household_id, kind, persona, categoria, titulo, monto, fecha,
        pagado, carrito, reloj, cuenta, fuente_id, mes_ref, created_by, updated_at
      ) values (
        ${id}, ${me.household.id}, ${kind}, ${persona}, ${categoria}, ${titulo}, ${monto}, ${fecha},
        ${Boolean(it.pagado)}, ${Boolean(it.carrito)}, ${Boolean(it.reloj)}, ${it.cuenta !== false},
        ${it.fuenteId || null}, ${it.mesRef || null}, ${data.userId}, now()
      )
      on conflict (id) do update set
        kind = excluded.kind,
        persona = excluded.persona,
        categoria = excluded.categoria,
        titulo = excluded.titulo,
        monto = excluded.monto,
        fecha = excluded.fecha,
        pagado = excluded.pagado,
        carrito = excluded.carrito,
        reloj = excluded.reloj,
        cuenta = excluded.cuenta,
        fuente_id = excluded.fuente_id,
        mes_ref = excluded.mes_ref,
        updated_at = now()
    `;

    const state = await loadState(sql, data.userId);
    return state.status === "member" ? ok(state) : fail("Error");
  });

export const setFlag = createServerFn({ method: "POST" })
  .validator(
    (input: Who & { id: string; flag: "pagado" | "carrito" | "reloj"; value: boolean }) => input,
  )
  .handler(async ({ data }): Promise<Result> => {
    const sql = await getSql();
    const me = await loadState(sql, data.userId);
    if (me.status !== "member") return fail("No sos miembro");

    if (data.flag === "pagado") {
      await sql`
        update items set pagado = ${data.value},
          pagado_at = case when ${data.value} then now() else null end,
          updated_at = now()
        where id = ${data.id} and household_id = ${me.household.id}
      `;
    } else if (data.flag === "carrito") {
      await sql`
        update items set carrito = ${data.value}, updated_at = now()
        where id = ${data.id} and household_id = ${me.household.id}
      `;
    } else {
      await sql`
        update items set reloj = ${data.value}, updated_at = now()
        where id = ${data.id} and household_id = ${me.household.id}
      `;
    }
    const state = await loadState(sql, data.userId);
    return state.status === "member" ? ok(state) : fail("Error");
  });

export const removeItem = createServerFn({ method: "POST" })
  .validator((input: Who & { id: string }) => input)
  .handler(async ({ data }): Promise<Result> => {
    const sql = await getSql();
    const me = await loadState(sql, data.userId);
    if (me.status !== "member") return fail("No sos miembro");
    await sql`
      delete from items where id = ${data.id} and household_id = ${me.household.id}
    `;
    const state = await loadState(sql, data.userId);
    return state.status === "member" ? ok(state) : fail("Error");
  });
