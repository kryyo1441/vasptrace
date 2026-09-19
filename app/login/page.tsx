"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, Shield, User } from "lucide-react";
import { NetworkBackdrop } from "@/components/network-backdrop";

const CHAINS = ["Ethereum", "Polygon", "Arbitrum", "BNB Chain", "Bitcoin", "Tron", "Solana"];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 py-16">
      <NetworkBackdrop />
      <div className="flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Shield className="size-7" aria-hidden="true" />
        </div>
      </div>
      <div className="text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:[animation-delay:75ms] motion-safe:fill-mode-both">
        <h1 className="text-3xl font-bold tracking-tight">VASPtrace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to access investigation cases.</p>
      </div>

      <Card className="w-full max-w-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:[animation-delay:150ms] motion-safe:fill-mode-both">
        <CardContent className="flex flex-col gap-3 pt-1">
          <div className="relative w-full">
            <User
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && username && password && !loading && login()}
              className="h-10 pl-8"
              autoFocus
            />
          </div>
          <div className="relative w-full">
            <Lock
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && username && password && !loading && login()}
              className="h-10 pl-8"
            />
          </div>
          <Button onClick={login} disabled={!username || !password || loading} className="mt-1 gap-2">
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Trust strip — the login screen has the least real content of any
          page in the app; this fills the space with something true rather
          than empty air: every chain this actually traces live. */}
      <div className="flex max-w-sm flex-wrap items-center justify-center gap-x-2 gap-y-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 motion-safe:[animation-delay:300ms] motion-safe:fill-mode-both">
        {CHAINS.map((c) => (
          <span
            key={c}
            className="rounded-full border border-border bg-card/60 px-2.5 py-0.5 text-[11px] text-muted-foreground backdrop-blur-xl"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
