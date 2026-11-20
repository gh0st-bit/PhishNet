import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
import { apiRequest } from "@/lib/queryClient";
export default function ManagerDashboardPage() {
  const [notice, setNotice] = useState("");
  const q = useQuery<any>({ queryKey: ["/api/manager/overview"] });
  const remind = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest("POST", `/api/manager/assignments/${id}/remind`)
      ).json(),
    onSuccess: () => {
      setNotice("Reminder sent to the employee dashboard.");
      void q.refetch();
    },
    onError: (e) => setNotice(e.message),
  });
  const remindPath = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("POST", `/api/manager/paths/${id}/remind`)).json(),
    onSuccess: () => {
      setNotice("Path reminder sent.");
      void q.refetch();
    },
    onError: (e) => setNotice(e.message),
  });
  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap justify-between gap-3">
          <h1 className="text-2xl font-bold">Manager dashboard</h1>
          <RefreshButton onRefresh={() => q.refetch({ throwOnError: true })} />
        </div>
        <p>Your assigned teams’ learning and observed simulation outcomes.</p>
        {q.isLoading && <p role="status">Loading teams...</p>}
        {q.error && (
          <p role="alert">Unable to load your teams. Refresh to retry.</p>
        )}
        {notice && <p role="status">{notice}</p>}
        {q.data && !q.data.teams.length ? (
          <Card className="p-5">
            No teams assigned. Ask your organization administrator to assign
            your team in Setup & teams.
          </Card>
        ) : (
          q.data && (
            <>
              <p>Teams: {q.data.teams.map((t: any) => t.name).join(", ")}</p>
              <div className="grid sm:grid-cols-4 gap-3">
                {Object.entries(q.data.signals).map(([name, value]) => (
                  <Card key={name} className="p-4">
                    <p>{name === "accepted" ? "Messages accepted" : name}</p>
                    <strong>{String(value)}</strong>
                  </Card>
                ))}
              </div>
              <a href="/api/manager/export" className="underline">
                Export team learning CSV
              </a>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                      <th>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.members.map((m: any) => (
                      <tr className="border-t" key={m.id}>
                        <td className="py-2">{m.email}</td>
                        <td>{m.assigned}</td>
                        <td>{m.completed}</td>
                        <td>{m.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2 className="text-xl font-semibold">Learning follow-up</h2>
              {q.data.paths?.map((p: any) => (
                <Card key={p.id} className="p-3">
                  {p.email} — {p.title}
                  <p>
                    {p.completed_at ? "Completed" : "In progress"} · Due{" "}
                    {new Date(p.due_at).toLocaleDateString()}
                  </p>
                  {!p.completed_at && (
                    <Button
                      disabled={remindPath.isPending}
                      onClick={() => remindPath.mutate(p.id)}
                    >
                      Send path reminder
                    </Button>
                  )}
                </Card>
              ))}
              {q.data.assignments.map((a: any) => (
                <Card
                  key={a.id}
                  className="p-3 flex flex-wrap justify-between gap-3"
                >
                  <div>
                    {a.email} — {a.title}
                    <p className="text-sm">
                      {a.status} · Due {new Date(a.due_at).toLocaleDateString()}
                    </p>
                  </div>
                  {a.status !== "completed" && (
                    <Button
                      disabled={remind.isPending}
                      onClick={() => remind.mutate(a.id)}
                    >
                      Send learning reminder
                    </Button>
                  )}
                </Card>
              ))}
            </>
          )
        )}
      </div>
    </AppLayout>
  );
}
