import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
export default function PilotContentPanel() {
  const cache = useQueryClient(),
    [notice, setNotice] = useState(""),
    [entity, setEntity] = useState("training_modules"),
    [id, setId] = useState("");
  const catalog = useQuery<any>({ queryKey: ["/api/pilot/starter-content"] });
  const versions = useQuery<any[]>({
    queryKey: ["/api/pilot/content-history", entity, id],
    enabled: /^[1-9][0-9]*$/.test(id),
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/pilot/content-history/${entity}/${id}`)
      ).json(),
  });
  const install = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/pilot/starter-content/install")).json(),
    onSuccess: (data) => {
      setNotice(data.message);
      void cache.invalidateQueries({ queryKey: ["/api/pilot/readiness"] });
    },
    onError: (e) => setNotice(e.message),
  });
  return (
    <Card className="p-5 space-y-3">
      <h2 className="text-xl font-semibold">
        Starter content and version history
      </h2>
      <p>
        {catalog.data?.lessons.length ?? 0} English lessons and{" "}
        {catalog.data?.scenarios.length ?? 0} simulation templates. Installation
        is repeatable and does not create campaigns or send mail. Review the
        content and sender details before use.
      </p>
      <Button
        disabled={!catalog.data || install.isPending}
        onClick={() => install.mutate()}
      >
        Install starter content
      </Button>
      {notice && <p role="status">{notice}</p>}
      <div className="flex flex-wrap gap-3">
        <label>
          Content type
          <select
            className="block border rounded bg-background p-2"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
          >
            {[
              "training_modules",
              "articles",
              "quizzes",
              "flashcard_decks",
              "email_templates",
              "landing_pages",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Content ID
          <Input
            inputMode="numeric"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
      </div>
      {versions.error && <p role="alert">Content history could not load.</p>}
      {versions.data?.map((v) => (
        <details key={v.version} className="border rounded p-3">
          <summary>
            Version {v.version} · {new Date(v.recorded_at).toLocaleString()}
          </summary>
          <pre className="overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(v.snapshot, null, 2)}
          </pre>
        </details>
      ))}
      {versions.data?.length === 0 && (
        <p>No versions found for this content in your organization.</p>
      )}
    </Card>
  );
}
