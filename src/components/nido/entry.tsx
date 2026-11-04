import { useState } from "react";
import { createHousehold, joinHousehold } from "@/lib/nido/api";
import { saveProfile, type LocalProfile } from "@/lib/profile";
import type { Owner } from "@/lib/nido/model";
import { PERSONA_NAME } from "@/lib/nido/model";

type Props = {
  profile: LocalProfile;
  onJoined: (p: LocalProfile) => void;
};

export function EntryScreen({ profile, onJoined }: Props) {
  const [mode, setMode] = useState<"pick" | "create" | "join">("pick");
  const [persona, setPersona] = useState<Owner>("spidy");
  const [name, setName] = useState(profile.displayName || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function doCreate() {
    setBusy(true);
    setError("");
    try {
      const displayName = name.trim() || PERSONA_NAME[persona];
      const res = await createHousehold({
        data: { userId: profile.userId, persona, displayName, name: "Nuestra caja" },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const next = saveProfile({
        displayName,
        persona: res.state.me.persona,
        householdId: res.state.household.id,
        inviteCode: res.state.household.inviteCode,
      });
      onJoined(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  async function doJoin() {
    setBusy(true);
    setError("");
    try {
      const displayName = name.trim() || "Yo";
      const res = await joinHousehold({
        data: {
          userId: profile.userId,
          inviteCode: code.trim().toUpperCase(),
          displayName,
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const next = saveProfile({
        displayName: res.state.me.displayName,
        persona: res.state.me.persona,
        householdId: res.state.household.id,
        inviteCode: res.state.household.inviteCode,
      });
      onJoined(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Nido</h1>
        <p className="mt-2 text-sm text-muted">
          Caja compartida · 🧚🏻 Spidy y ★ Estrella · se actualiza sola cada 4 s
        </p>
      </div>

      {mode === "pick" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("create")}
            className="w-full rounded-2xl bg-spidy py-3.5 text-sm font-semibold text-black"
          >
            Crear nuestra caja
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className="w-full rounded-2xl bg-estrella py-3.5 text-sm font-semibold text-black"
          >
            Entrar con código
          </button>
        </div>
      )}

      {mode === "create" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Elegí tu rol. El otro usará el que quede libre.</p>
          <div className="grid grid-cols-2 gap-2">
            {(["spidy", "estrella"] as Owner[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPersona(p)}
                className={`rounded-2xl px-3 py-4 text-sm font-semibold ${
                  persona === p
                    ? p === "spidy"
                      ? "bg-spidy text-black ring-2 ring-white/40"
                      : "bg-estrella text-black ring-2 ring-white/40"
                    : "bg-surface text-muted"
                }`}
              >
                {PERSONA_NAME[p]}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm"
            placeholder="Tu nombre (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm"
            >
              Atrás
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doCreate()}
              className="flex-1 rounded-xl bg-spidy py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear caja"}
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Pedile el código de 6 caracteres a tu pareja.</p>
          <input
            className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] uppercase"
            placeholder="ABC123"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm"
            placeholder="Tu nombre (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm"
            >
              Atrás
            </button>
            <button
              type="button"
              disabled={busy || code.trim().length < 4}
              onClick={() => void doJoin()}
              className="flex-1 rounded-xl bg-estrella py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
