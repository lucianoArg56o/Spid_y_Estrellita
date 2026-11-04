export type Owner = "spidy" | "estrella";
export type Persona = Owner | "ambos";
export type Kind =
  | "gasto"
  | "especulacion"
  | "compra"
  | "obligacion"
  | "ingreso"
  | "transferencia";

export type Item = {
  id: string;
  kind: Kind;
  persona: Persona;
  categoria: string;
  titulo: string;
  monto: number;
  fecha: string;
  pagado: boolean;
  carrito: boolean;
  reloj: boolean;
  cuenta: boolean;
  fuenteId: string | null;
  mesRef: string | null;
  pagadoAt: string | null;
  createdBy: string;
  updatedAt: string;
};

export type ItemInput = Omit<Item, "pagadoAt" | "createdBy" | "updatedAt">;

export type Balance = {
  persona: Owner;
  sueldo: number;
  disponible: number;
  disponibleSet: boolean;
  disponibleAt: string | null;
  sueldoSet: boolean;
};

export type MemberState = {
  status: "member";
  household: { id: string; name: string; inviteCode: string };
  me: { persona: Owner; displayName: string; userId: string };
  members: { persona: Owner; displayName: string }[];
  balances: Balance[];
  items: Item[];
  serverTime: string;
};

export type NidoState = MemberState | { status: "guest" };

export type Result =
  | { ok: true; state: MemberState }
  | { ok: false; error: string };

/** Labels visibles: 🧚🏻 = Spidy (azul), ★ = Estrella (rosa) */
export const PERSONA_NAME: Record<Owner, string> = {
  spidy: "🧚🏻 Spidy",
  estrella: "★ Estrella",
};

export const PERSONA_SHORT: Record<Owner, string> = {
  spidy: "🧚🏻",
  estrella: "★",
};

export const CATEGORIES = [
  { id: "comida", label: "Comida" },
  { id: "limpieza", label: "Limpieza" },
  { id: "hogar", label: "Hogar" },
  { id: "transporte", label: "Transporte" },
  { id: "salud", label: "Salud" },
  { id: "ocio", label: "Ocio" },
  { id: "servicios", label: "Servicios" },
  { id: "otro", label: "Otro" },
] as const;

export function coerceOwner(v: unknown): Owner | null {
  return v === "spidy" || v === "estrella" ? v : null;
}

export function coercePersona(v: unknown): Persona | null {
  return v === "spidy" || v === "estrella" || v === "ambos" ? v : null;
}

export function coerceKind(v: unknown): Kind | null {
  const ok = ["gasto", "especulacion", "compra", "obligacion", "ingreso", "transferencia"];
  return typeof v === "string" && ok.includes(v) ? (v as Kind) : null;
}

export function money(n: number) {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function newId() {
  return crypto.randomUUID();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Inicio de la semana (lunes) en ISO date */
export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

export function isThisWeek(fecha: string) {
  return fecha >= startOfWeek();
}
