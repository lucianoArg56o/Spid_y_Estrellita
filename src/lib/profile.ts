/** Perfil local (solo en este navegador / teléfono). */

export type LocalProfile = {
  userId: string;
  displayName: string;
  persona: "spidy" | "estrella" | null;
  householdId: string | null;
  inviteCode: string | null;
};

const KEY = "nido.profile.v1";

function blank(): LocalProfile {
  return {
    userId: crypto.randomUUID(),
    displayName: "",
    persona: null,
    householdId: null,
    inviteCode: null,
  };
}

export function loadProfile(): LocalProfile {
  if (typeof window === "undefined") return blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const p = blank();
      localStorage.setItem(KEY, JSON.stringify(p));
      return p;
    }
    const parsed = JSON.parse(raw) as LocalProfile;
    if (!parsed.userId) parsed.userId = crypto.randomUUID();
    return parsed;
  } catch {
    return blank();
  }
}

export function saveProfile(patch: Partial<LocalProfile>): LocalProfile {
  const current = loadProfile();
  const next = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearHousehold() {
  return saveProfile({ householdId: null, inviteCode: null, persona: null });
}
