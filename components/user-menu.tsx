"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

// Self-fetching rather than prop-threaded — app/page.tsx is already a
// client component (the trace form), while the /cases pages are server
// components; this way the same component drops in everywhere without
// plumbing the current user through each page's own data fetching.
export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="hidden sm:inline">
        {user.username} · {user.role === "SUPERVISOR" ? "Supervisor" : "Investigator"}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={logout}>
        <LogOut className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
