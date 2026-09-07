import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RISK_COLOR: Record<string, string> = {
  LOW: "#16a34a",
  MEDIUM: "#ca8a04",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export default async function CasesPage() {
  const cases = await prisma.case.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Case dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {cases.length} case{cases.length === 1 ? "" : "s"} traced so far.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          New trace
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases yet — run a trace from the home page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Address</th>
                    <th className="py-2 pr-4 font-medium">Chain</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Risk</th>
                    <th className="py-2 pr-4 font-medium">Recommended VASP</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="py-2 pr-4 font-mono">
                        <Link href={`/cases/${c.id}`} className="hover:underline">
                          {c.address}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{c.chain}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{c.status}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {c.riskLevel ? (
                          <Badge
                            variant="outline"
                            style={{ borderColor: RISK_COLOR[c.riskLevel], color: RISK_COLOR[c.riskLevel] }}
                          >
                            {c.riskLevel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{c.recommendedVaspId ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {c.createdAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
