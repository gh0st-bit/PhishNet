import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshButton } from "@/components/ui/refresh-button";
export default function CampaignEventTimeline({ id }: { id: number }) {
  const q = useQuery<{
    events: {
      event_type: string;
      target_id: number;
      created_at: string;
      suspected_automated: boolean;
    }[];
  }>({ queryKey: [`/api/campaigns/${id}/events`], refetchInterval: 15000 });
  const [target, setTarget] = useState("all");
  return (
    <section className="border rounded p-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-semibold">Recipient event timeline</h3>
        <RefreshButton onRefresh={() => q.refetch({ throwOnError: true })} />
      </div>
      <label>
        Recipient
        <select
          className="ml-2 bg-background border rounded p-2"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="all">All recipients</option>
          {[...new Set(q.data?.events.map((e) => e.target_id))].map((t) => (
            <option key={t} value={t}>
              Recipient {t}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        Latest 200 observations. Scanner-suspected events are identified
        separately and do not establish a human click.
      </p>
      {q.error && <p role="alert">Events could not load.</p>}
      <div className="max-h-72 overflow-auto">
        {q.data?.events
          .filter((e) => target === "all" || String(e.target_id) === target)
          .map((e, index) => (
            <p key={index} className="border-t py-2 text-sm">
              {new Date(e.created_at).toLocaleString()} · Recipient{" "}
              {e.target_id} · {e.event_type} ·{" "}
              {e.suspected_automated
                ? "Suspected automation"
                : "Observed activity"}
            </p>
          ))}
      </div>
      {q.data?.events.length === 0 && <p>No observed events yet.</p>}
    </section>
  );
}
