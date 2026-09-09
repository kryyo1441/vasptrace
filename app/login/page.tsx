"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, Shield } from "lucide-react";

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
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Shield className="size-7" aria-hidden="true" />
        </div>
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">VASPtrace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to access investigation cases.</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-3 pt-1">
          <div className="relative w-full">
            <Input
              aria-label="Username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && username && password && !loading && login()}
              className="h-10"
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
