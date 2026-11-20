import { useState } from "react";
import { roleNames } from "@shared/access-control";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
export default function LearningPathBuilder() {
  const resources = useQuery<any[]>({
      queryKey: ["/api/pilot/path-resources"],
    }),
    paths = useQuery<any[]>({ queryKey: ["/api/pilot/learning-paths"] }),
    users = useQuery<any[]>({ queryKey: ["/api/users"] });
  const [name, setName] = useState(""),
    [chosen, setChosen] = useState(""),
    [steps, setSteps] = useState<{ kind: string; id: number; title: string }[]>(
      [],
    ),
    [path, setPath] = useState(""),
    [ids, setIds] = useState<number[]>([]),
    [days, setDays] = useState(14),
    [notice, setNotice] = useState("");
  const create = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/pilot/learning-paths", {
          name,
          steps: steps.map(({ kind, id }) => ({ kind, id })),
        })
      ).json(),
    onSuccess: (data) => {
      setPath(String(data.id));
      setNotice("Learning path created. Choose employees to assign it.");
      void paths.refetch();
    },
    onError: (e) => setNotice(e.message),
  });
  const assign = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", `/api/pilot/learning-paths/${path}/assign`, {
          userIds: ids,
          dueDays: days,
        })
      ).json(),
    onSuccess: (data) =>
      setNotice(
        `Assigned to ${data.assigned} employee(s). Existing assignments were preserved.`,
      ),
    onError: (e) => setNotice(e.message),
  });
  return (
    <Card className="p-5 space-y-4">
      <h2 className="text-xl font-semibold">Guided learning paths</h2>
      <p>
        Combine lessons, published articles, decks and untimed quizzes.
        Employees complete steps in order; assigned content is captured when
        assigned.
      </p>
      {(resources.error || paths.error || users.error) && (
        <p role="alert">Learning-path setup could not load.</p>
      )}
      <label>
        Path name
        <Input
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Add content
        <select
          className="block bg-background border rounded p-2 w-full"
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
        >
          <option value="">Choose published content</option>
          {resources.data?.map((r) => (
            <option key={r.kind + ":" + r.id} value={r.kind + ":" + r.id}>
              {r.kind}: {r.title}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="outline"
        disabled={!chosen || steps.length >= 20}
        onClick={() => {
          const r = resources.data?.find((r) => r.kind + ":" + r.id === chosen);
          if (r) setSteps([...steps, r]);
        }}
      >
        Add step
      </Button>
      <ol>
        {steps.map((s, index) => (
          <li key={index} className="flex gap-3">
            {index + 1}. {s.title}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSteps(steps.filter((_s, i) => i !== index))}
            >
              Remove step {index + 1}
            </Button>
          </li>
        ))}
      </ol>
      <Button
        disabled={!name.trim() || !steps.length || create.isPending}
        onClick={() => create.mutate()}
      >
        Create learning path
      </Button>
      <hr />
      <label>
        Assign a saved path
        <select
          className="block border rounded bg-background p-2"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        >
          <option value="">Choose path</option>
          {paths.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Due within days
        <Input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </label>
      <fieldset className="max-h-40 overflow-auto">
        <legend>Employees</legend>
        {users.data
          ?.filter(
            (u) =>
              u.isActive &&
              roleNames(u.roles).includes("User") &&
              !roleNames(u.roles).some((r: string) =>
                ["Admin", "OrgAdmin", "Manager"].includes(r),
              ),
          )
          .map((u) => (
            <label key={u.id} className="block">
              <input
                type="checkbox"
                checked={ids.includes(u.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, u.id]
                      : ids.filter((id) => id !== u.id),
                  )
                }
              />
              {u.email}
            </label>
          ))}
      </fieldset>
      <Button
        disabled={!path || !ids.length || ids.length > 100 || assign.isPending}
        onClick={() => assign.mutate()}
      >
        Assign learning path
      </Button>
      {notice && <p role="status">{notice}</p>}
    </Card>
  );
}
