"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DashboardData, Stage } from "./data";
import { Overview } from "./overview";

export function Live({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const put = async (path: string, body: unknown): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) setError("The change was not saved. Try again.");
      start(() => router.refresh());
    } catch {
      setError("The service could not be reached. Nothing was changed.");
    } finally {
      setSaving(false);
    }
  };
  return <Overview data={data} busy={saving || pending} error={error} onKillSwitch={(on) => void put("/v1/admin/kill-switch", { on })} onStage={(id, stage: Stage) => void put(`/v1/admin/repos/${id}/stage`, { stage })} />;
}
