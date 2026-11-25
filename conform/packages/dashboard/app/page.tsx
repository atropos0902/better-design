import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DashboardData } from "../src/data";
import { Live } from "../src/live";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = (await cookies()).get("conform_session");
  const res = await fetch(`${process.env["SERVICE_URL"]}/v1/dashboard`, { headers: session ? { cookie: `conform_session=${session.value}` } : {}, cache: "no-store" }).catch(() => null);
  if (res?.status === 401) redirect(`/auth/login?customer=${encodeURIComponent(process.env["CUSTOMER"] ?? "")}`);
  if (!res?.ok) {
    return (
      <main className="bg-surface-page p-section flex flex-col gap-medium min-h-screen">
        <h1 className="text-title font-bold text-primary">The review service can't be reached</h1>
        <p className="text-body text-muted">Pull requests aren't blocked while it is down. They get comments only.</p>
      </main>
    );
  }
  return <Live data={(await res.json()) as DashboardData} />;
}
