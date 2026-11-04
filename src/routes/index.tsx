import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EntryScreen } from "@/components/nido/entry";
import { NidoApp } from "@/components/nido/app";
import { loadProfile, type LocalProfile } from "@/lib/profile";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  if (!ready || !profile) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted">
        Nido…
      </div>
    );
  }

  const inHouse = Boolean(profile.householdId && profile.persona);

  if (!inHouse) {
    return (
      <EntryScreen
        profile={profile}
        onJoined={(p) => setProfile(p)}
      />
    );
  }

  return (
    <NidoApp
      profile={profile}
      onLeave={() => setProfile(loadProfile())}
    />
  );
}
