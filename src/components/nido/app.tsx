import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getState,
  removeItem,
  saveItem,
  setFlag,
  setMoney,
} from "@/lib/nido/api";
import {
  CATEGORIES,
  isThisWeek,
  money,
  newId,
  PERSONA_NAME,
  PERSONA_SHORT,
  today,
  type Item,
  type ItemInput,
  type Kind,
  type MemberState,
  type Owner,
  type Persona,
} from "@/lib/nido/model";
import { clearHousehold, type LocalProfile } from "@/lib/profile";

type Props = { profile: LocalProfile; onLeave: () => void };

const KINDS: { id: Kind; label: string }[] = [
  { id: "gasto", label: "Gasto" },
  { id: "compra", label: "Compra" },
  { id: "ingreso", label: "Ingreso" },
  { id: "transferencia", label: "Transfer" },
  { id: "obligacion", label: "Obligación" },
  { id: "especulacion", label: "Especulación" },
];

type Tab = "todo" | "semana" | "compras" | "obligaciones";

export function NidoApp({ profile, onLeave }: Props) {
  const qc = useQueryClient();
  const who = { userId: profile.userId, displayName: profile.displayName };

  const q = useQuery({
    queryKey: ["nido", profile.userId],
    queryFn: () => getState({ data: who }),
    refetchInterval: 4000,
    enabled: Boolean(profile.userId),
  });

  const state = q.data?.status === "member" ? (q.data as MemberState) : null;

  const mutate = useMutation({
    mutationFn: async (fn: () => Promise<{ ok: boolean; error?: string; state?: MemberState }>) => {
      const res = await fn();
      if (!res.ok) throw new Error(res.error || "Error");
      return res;
    },
    onSuccess: (res) => {
      if (res.state) qc.setQueryData(["nido", profile.userId], res.state);
    },
  });

  const [tab, setTab] = useState<Tab>("todo");
  const [catFilter, setCatFilter] = useState<string>("todas");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ItemInput>({
    id: "",
    kind: "gasto",
    persona: profile.persona || "spidy",
    categoria: "comida",
    titulo: "",
    monto: 0,
    fecha: today(),
    pagado: false,
    carrito: false,
    reloj: false,
    cuenta: true,
    fuenteId: null,
    mesRef: null,
  });

  const calc = useMemo(() => {
    if (!state) {
      return {
        sueldoTotal: 0,
        disponibleReal: 0,
        especulado: 0,
        pagadoSum: 0,
        carritoSum: 0,
        relojSum: 0,
        semanaGasto: 0,
      };
    }
    const sueldoTotal = state.balances.reduce((s, b) => s + b.sueldo, 0);
    const disponibleReal = state.balances.reduce((s, b) => s + b.disponible, 0);

    let pagadoSum = 0;
    let carritoSum = 0;
    let relojSum = 0;
    let semanaGasto = 0;

    for (const it of state.items) {
      if (it.kind === "ingreso" || it.kind === "transferencia") continue;
      if (!it.cuenta) continue;
      if (it.pagado) pagadoSum += it.monto;
      else if (it.carrito) carritoSum += it.monto;
      if (it.reloj && !it.pagado) relojSum += it.monto;
      if (isThisWeek(it.fecha) && (it.pagado || it.carrito || it.kind === "especulacion")) {
        semanaGasto += it.monto;
      }
    }

    const especulado = disponibleReal - carritoSum - relojSum;

    return {
      sueldoTotal,
      disponibleReal,
      especulado,
      pagadoSum,
      carritoSum,
      relojSum,
      semanaGasto,
    };
  }, [state]);

  const filteredItems = useMemo(() => {
    if (!state) return [];
    let list = [...state.items].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    if (tab === "semana") {
      list = list.filter((it) => isThisWeek(it.fecha));
    } else if (tab === "compras") {
      list = list.filter(
        (it) =>
          it.kind === "compra" ||
          it.carrito ||
          it.categoria === "comida" ||
          it.categoria === "limpieza",
      );
    } else if (tab === "obligaciones") {
      list = list.filter((it) => it.kind === "obligacion" || it.reloj);
    }

    if (catFilter !== "todas") {
      list = list.filter((it) => it.categoria === catFilter);
    }
    return list;
  }, [state, tab, catFilter]);

  function exportLista() {
    if (!state) return;
    const lines = state.items
      .filter((it) => it.carrito || (it.kind === "compra" && !it.pagado))
      .map((it) => {
        const flags = [it.carrito ? "🛒" : "", it.pagado ? "💰" : ""].filter(Boolean).join(" ");
        return `• ${it.titulo || it.categoria} — ${money(it.monto)} ${flags}`.trim();
      });
    const text =
      `Lista Nido · ${state.household.name}\n` +
      `Código: ${state.household.inviteCode}\n` +
      `—\n` +
      (lines.length ? lines.join("\n") : "(sin ítems en carrito)") +
      `\n—\nDisponible: ${money(calc.disponibleReal)} → Especulado: ${money(calc.especulado)}`;

    if (navigator.share) {
      navigator.share({ title: "Lista Nido", text }).catch(() => {
        void navigator.clipboard?.writeText(text);
        alert("Lista copiada al portapapeles");
      });
    } else {
      void navigator.clipboard?.writeText(text);
      alert("Lista copiada al portapapeles");
    }
  }

  if (q.isLoading || q.isPending) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted">
        Cargando caja…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-5 py-10">
        <p className="text-sm text-muted">No estás en ninguna caja en este dispositivo.</p>
        <button
          type="button"
          className="rounded-xl bg-spidy px-4 py-2 text-sm font-semibold text-black"
          onClick={() => {
            clearHousehold();
            onLeave();
          }}
        >
          Configurar de nuevo
        </button>
      </div>
    );
  }

  async function submitItem() {
    const item: ItemInput = {
      ...form,
      id: form.id || newId(),
      monto: Number(form.monto) || 0,
      titulo: form.titulo.trim(),
    };
    await mutate.mutateAsync(() => saveItem({ data: { ...who, item } }));
    setShowForm(false);
    setForm((f) => ({
      ...f,
      id: "",
      titulo: "",
      monto: 0,
      pagado: false,
      carrito: false,
      reloj: false,
    }));
  }

  const busy = mutate.isPending;

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col pb-28">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#12110e]/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">{state.household.name}</h1>
            <p className="mt-0.5 text-[11px] text-muted">
              Código{" "}
              <span className="font-mono tracking-wider text-in">{state.household.inviteCode}</span>
              {" · "}
              {PERSONA_NAME[state.me.persona]}
            </p>
          </div>
          <button
            type="button"
            className="text-[11px] text-muted underline"
            onClick={() => {
              if (confirm("¿Salir de esta caja en este teléfono?")) {
                clearHousehold();
                onLeave();
              }
            }}
          >
            Salir
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-surface px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">Total disponible</span>
            <span className="text-sm font-semibold tabular-nums">{money(calc.disponibleReal)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">→ Especulado</span>
            <span
              className={`text-base font-bold tabular-nums ${
                calc.especulado < 0 ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {money(calc.especulado)}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-muted">
            Real − carrito ({money(calc.carritoSum)}) − reloj ({money(calc.relojSum)})
            {calc.pagadoSum > 0 ? ` · ya pagado ${money(calc.pagadoSum)}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        <section className="grid grid-cols-2 gap-2">
          {state.balances.map((b) => (
            <MoneyCard
              key={b.persona}
              balance={b}
              busy={busy}
              onSave={(field, amount) =>
                mutate.mutateAsync(() =>
                  setMoney({
                    data: { ...who, persona: b.persona, field, amount },
                  }),
                )
              }
            />
          ))}
        </section>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {(
            [
              ["todo", "Todo"],
              ["semana", "Semana"],
              ["compras", "Compras"],
              ["obligaciones", "Oblig."],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                tab === id ? "bg-white/20 text-in" : "bg-white/5 text-muted"
              }`}
            >
              {label}
              {id === "semana" ? ` · ${money(calc.semanaGasto)}` : ""}
            </button>
          ))}
          <button
            type="button"
            onClick={exportLista}
            className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-xs text-muted"
          >
            Exportar 📋
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCatFilter("todas")}
            className={`shrink-0 rounded-lg px-2 py-1 text-[11px] ${
              catFilter === "todas" ? "bg-white/15" : "bg-white/5 text-muted"
            }`}
          >
            Todas
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(c.id)}
              className={`shrink-0 rounded-lg px-2 py-1 text-[11px] ${
                catFilter === c.id ? "bg-white/15" : "bg-white/5 text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <section className="space-y-2">
          {filteredItems.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">Sin movimientos acá.</p>
          )}
          {filteredItems.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              busy={busy}
              onFlag={(flag, value) =>
                mutate.mutateAsync(() =>
                  setFlag({ data: { ...who, id: it.id, flag, value } }),
                )
              }
              onRemove={() =>
                mutate.mutateAsync(() => removeItem({ data: { ...who, id: it.id } }))
              }
            />
          ))}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#12110e]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex-1 rounded-2xl bg-spidy py-3 text-sm font-semibold text-black"
          >
            {showForm ? "Cerrar" : "+ Nuevo movimiento"}
          </button>
        </div>

        {showForm && (
          <div className="mx-auto mt-3 max-w-lg space-y-2 rounded-2xl bg-surface p-3">
            <div className="flex flex-wrap gap-1">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, kind: k.id }))}
                  className={`rounded-lg px-2 py-1 text-[11px] ${
                    form.kind === k.id ? "bg-white/20" : "bg-white/5 text-muted"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
              placeholder="Qué es…"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="Monto"
                value={form.monto || ""}
                onChange={(e) => setForm((f) => ({ ...f, monto: Number(e.target.value) || 0 }))}
              />
              <input
                type="date"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(["spidy", "estrella", "ambos"] as Persona[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, persona: p }))}
                  className={`rounded-lg px-2 py-1 text-[11px] ${
                    form.persona === p ? "bg-white/20" : "bg-white/5 text-muted"
                  }`}
                >
                  {p === "ambos" ? "Ambos" : PERSONA_SHORT[p]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, categoria: c.id }))}
                  className={`rounded-lg px-2 py-1 text-[11px] ${
                    form.categoria === c.id ? "bg-white/20" : "bg-white/5 text-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Toggle
                label="💰 Pagado"
                on={form.pagado}
                onClick={() => setForm((f) => ({ ...f, pagado: !f.pagado }))}
              />
              <Toggle
                label="🛒 Carrito"
                on={form.carrito}
                onClick={() => setForm((f) => ({ ...f, carrito: !f.carrito }))}
              />
              <Toggle
                label="⏳ Reloj"
                on={form.reloj}
                onClick={() => setForm((f) => ({ ...f, reloj: !f.reloj }))}
              />
            </div>
            <button
              type="button"
              disabled={busy || !form.titulo.trim()}
              onClick={() => void submitItem()}
              className="w-full rounded-xl bg-estrella py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyCard({
  balance,
  busy,
  onSave,
}: {
  balance: MemberState["balances"][0];
  busy: boolean;
  onSave: (field: "sueldo" | "disponible", amount: number) => void;
}) {
  const [edit, setEdit] = useState<"sueldo" | "disponible" | null>(null);
  const [val, setVal] = useState("");
  const isSpidy = balance.persona === "spidy";

  return (
    <div
      className={`rounded-2xl px-3 py-2.5 ${
        isSpidy ? "bg-wash-spidy ring-1 ring-spidy/30" : "bg-wash-estrella ring-1 ring-estrella/30"
      }`}
    >
      <p className="text-[11px] font-medium text-muted">{PERSONA_NAME[balance.persona]}</p>
      <button
        type="button"
        className="mt-1 block w-full text-left text-sm font-semibold tabular-nums"
        onClick={() => {
          setEdit("disponible");
          setVal(String(balance.disponible || ""));
        }}
      >
        Disp. {money(balance.disponible)}
      </button>
      <button
        type="button"
        className="mt-0.5 block w-full text-left text-[11px] text-muted"
        onClick={() => {
          setEdit("sueldo");
          setVal(String(balance.sueldo || ""));
        }}
      >
        Sueldo {money(balance.sueldo)}
      </button>

      {edit && (
        <div className="mt-2 flex gap-1">
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            className="w-full rounded-lg border border-white/20 bg-black/40 px-2 py-1 text-sm"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-white/20 px-2 text-xs"
            onClick={() => {
              onSave(edit, Number(val) || 0);
              setEdit(null);
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  busy,
  onFlag,
  onRemove,
}: {
  item: Item;
  busy: boolean;
  onFlag: (flag: "pagado" | "carrito" | "reloj", value: boolean) => void;
  onRemove: () => void;
}) {
  const ownerColor =
    item.persona === "spidy"
      ? "border-l-spidy"
      : item.persona === "estrella"
        ? "border-l-estrella"
        : "border-l-white/20";

  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border-l-4 bg-surface px-3 py-2.5 ${ownerColor}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{item.titulo || item.categoria}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{money(item.monto)}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted">
          {item.fecha} · {item.kind}
          {item.persona !== "ambos" ? ` · ${PERSONA_SHORT[item.persona as Owner]}` : " · ambos"}
          {item.categoria ? ` · ${item.categoria}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <FlagBtn
            label="💰"
            on={item.pagado}
            disabled={busy}
            onClick={() => onFlag("pagado", !item.pagado)}
          />
          <FlagBtn
            label="🛒"
            on={item.carrito}
            disabled={busy}
            onClick={() => onFlag("carrito", !item.carrito)}
          />
          <FlagBtn
            label="⏳"
            on={item.reloj}
            disabled={busy}
            onClick={() => onFlag("reloj", !item.reloj)}
          />
        </div>
      </div>
      <button type="button" className="text-xs text-muted" onClick={onRemove} disabled={busy}>
        ✕
      </button>
    </div>
  );
}

function FlagBtn({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-1.5 py-0.5 text-xs ${
        on ? "bg-white/25 text-in" : "bg-white/5 text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2 py-1 text-[11px] ${on ? "bg-white/20" : "bg-white/5 text-muted"}`}
    >
      {label}
    </button>
  );
}
