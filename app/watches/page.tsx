import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { WatchesPanel } from "@/components/watches-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { ArrowLeft } from "lucide-react";

export default async function WatchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8 lg:px-10 xl:px-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Case dashboard
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <WatchesPanel />
    </div>
  );
}
