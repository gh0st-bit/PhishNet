import {useAuth} from '@/hooks/use-auth';
import LearningPathBuilder from "@/components/content/learning-path-builder";
import { roleNames } from "@shared/access-control";
import PilotContentPanel from "@/components/content/pilot-content-panel";
import MicrosoftConnectionSettings from "@/components/email/microsoft-connection-settings";
import { useState } from "react";
import Papa from "papaparse";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { apiRequest } from "@/lib/queryClient";
export default function PilotSetupPage() {
  const {user}=useAuth();
  const [step,setStep]=useState(()=>{try{return sessionStorage.getItem('setup-step:'+user?.id)||'readiness';}catch{return 'readiness';}});
  function chooseStep(value:string){setStep(value);try{sessionStorage.setItem('setup-step:'+user?.id,value);}catch{}}
  const [notice, setNotice] = useState(""),
    [csv, setCsv] = useState(""),
    [mapping, setMapping] = useState({
      email: "email",
      firstName: "firstName",
      lastName: "lastName",
    }),
    [preview, setPreview] = useState<any>(null),
    [confirm, setConfirm] = useState(false);
  const [team, setTeam] = useState<{
    id?: number;
    name: string;
    members: number[];
    managers: number[];
  }>({ name: "", members: [], managers: [] });
  const ready = useQuery<any>({ queryKey: ["/api/pilot/readiness"] }),
    teams = useQuery<any[]>({ queryKey: ["/api/pilot/teams"] }),
    users = useQuery<any[]>({ queryKey: ["/api/users"] }),
    imports = useQuery<any[]>({ queryKey: ["/api/pilot/imports"] });
  const columns =
    Papa.parse(csv, { header: true, skipEmptyLines: true }).meta.fields || [];
  const refresh = () =>
    Promise.all([
      ready.refetch({ throwOnError: true }),
      teams.refetch({ throwOnError: true }),
      users.refetch({ throwOnError: true }),
      imports.refetch({ throwOnError: true }),
    ]);
  const request = useMutation({
    mutationFn: async ({
      method = "POST",
      url,
      data,
    }: {
      method?: string;
      url: string;
      data?: any;
    }) => (await apiRequest(method, url, data)).json(),
    onError: (e) => setNotice(e.message),
    onSuccess: (_data, vars) => {
      setNotice(
        vars.url.includes("/invite")
          ? "Invitation request finished. Review enrollment for delivery status."
          : "Saved.",
      );
      void refresh();
    },
  });
  const review = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/pilot/import/preview", { csv, mapping })
      ).json(),
    onSuccess: (data) => {
      setPreview(data);
      setConfirm(false);
      setNotice("Preview ready. Nothing has been sent.");
    },
    onError: (e) => setNotice(e.message),
  });
  const newEmails =
    preview?.rows
      .filter((r: any) => r.status === "new")
      .map((r: any) => r.email) || [];
  function downloadErrors() {
    const blob = new Blob(
      [
        Papa.unparse(preview?.rows.filter((r: any) => r.error) || [], {
          escapeFormulae: true,
        }),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "employee-import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between gap-3">
          <h1 className="text-2xl font-bold">Setup & teams</h1>
          <RefreshButton onRefresh={refresh} />
        </div>
        <p>
          Review setup without sending mail. Progress is saved through your
          organization’s configuration.
        </p>
        {(ready.error || teams.error || users.error || imports.error) && (
          <p role="alert">
            Some setup information could not load. Refresh to retry.
          </p>
        )}
        {ready.data?.workerDeliveryPaused && (
          <p className="rounded border p-3">
            Background work is paused for development. Campaigns will not send
            while the worker is paused.
          </p>
        )}
        {notice && (
          <p role="status" className="rounded border p-3">
            {notice}
          </p>
        )}
        <nav aria-label="Setup steps" className="flex gap-2 flex-wrap">{[['readiness','1. Organization'],['people','2. People & teams'],['delivery','3. Delivery'],['content','4. Content'],['review','5. Readiness review']].map(([id,label])=><Button key={id} variant={step===id?'default':'outline'} aria-current={step===id?'step':undefined} onClick={()=>chooseStep(id)}>{label}</Button>)}</nav>
        {(step==='readiness'||step==='review')&&<Card className="p-5 space-y-3">
          <h2 className="text-xl font-semibold">Pilot readiness</h2>
          {ready.data?.checks.map((c: any) => (
            <p key={c.id}>
              {c.complete ? "Complete" : "To do"}: {c.label}
            </p>
          ))}
          <p className="text-sm">{ready.data?.message}</p>
          <h3 className="font-semibold">Integration readiness</h3><p>Sending connections: {ready.data?.integrations?.connections?.length? 'Configured?unverified':'Not configured'}</p><p>{ready.data?.integrations?.verification}</p>
          <div className="flex flex-wrap gap-4 underline">
            <Link href="/org-admin/settings">Organization preferences</Link>
            <Link href="/org-admin/enrollment">Invitations</Link>
            <Link href="/org-admin/delivery">Email delivery</Link>
            <Link href="/org-admin/training-assignments">Assign learning</Link>
          </div>
        </Card>}
        <div hidden={step!=='people'}><Card className="p-5 space-y-3">
          <h2 className="text-xl font-semibold">Employee import preview</h2>
          <label className="block">
            CSV file
            <input
              className="block"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 1000000) {
                    setNotice("Choose a CSV smaller than 1 MB");
                    return;
                  }
                  setCsv(await file.text());
                  setPreview(null);
                  setConfirm(false);
                }
              }}
            />
          </label>
          <label className="block">
            CSV text
            <textarea
              className="block w-full h-28 border rounded bg-background p-2"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
                setConfirm(false);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            {(["email", "firstName", "lastName"] as const).map((key) => (
              <label key={key}>
                {key}
                <select
                  className="block border rounded bg-background p-2"
                  value={mapping[key]}
                  onChange={(e) => {
                    setMapping({ ...mapping, [key]: e.target.value });
                    setPreview(null);
                    setConfirm(false);
                  }}
                >
                  <option value="">Choose column</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <Button
            disabled={!csv.trim() || !mapping.email || review.isPending}
            onClick={() => review.mutate()}
          >
            Preview import
          </Button>
          {preview && (
            <>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r: any) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.email}</td>
                        <td>{r.status}</td>
                        <td>{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={downloadErrors}>
                  Download row errors
                </Button>
                <Button
                  disabled={
                    preview.rows.some((r: any) => r.error) || request.isPending
                  }
                  onClick={() =>
                    request.mutate({
                      url: "/api/pilot/import/save",
                      data: { csv, mapping },
                    })
                  }
                >
                  Save import draft
                </Button>
              </div>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                Send invitations to the {newEmails.length} valid new addresses
                shown above.
              </label>
              <Button
                disabled={
                  !confirm ||
                  !newEmails.length ||
                  newEmails.length > 100 ||
                  request.isPending
                }
                onClick={() =>
                  request.mutate({
                    url: "/api/admin/enroll/invite",
                    data: { emails: newEmails },
                  })
                }
              >
                Send selected invitations
              </Button>
              <p className="text-sm">
                Maximum 100 invitations per request. Saving an import does not
                create accounts or send mail.
              </p>
            </>
          )}
          {imports.data && (
            <p className="text-sm">Saved imports: {imports.data.length}.</p>
          )}
        </Card>
        </div>
        <div hidden={step!=='content'} className="space-y-6"><PilotContentPanel /><LearningPathBuilder /></div>
        <div hidden={step!=='delivery'}><MicrosoftConnectionSettings /><p className="mt-4 rounded border p-4">Connection configuration is unverified until authentication and controlled delivery are demonstrated. No email is sent by setup.</p></div>
        <div hidden={step!=='people'}>
        <Card className="p-5 space-y-4">
          <h2 className="text-xl font-semibold">Teams and manager access</h2>
          <p>
            Managers see assigned teams and can send learning reminders.
            Unassigned managers see an empty dashboard.
          </p>
          <div className="flex flex-wrap gap-2">
            {teams.data?.map((t) => (
              <Button
                variant="outline"
                key={t.id}
                onClick={() =>
                  setTeam({
                    id: t.id,
                    name: t.name,
                    members: t.members,
                    managers: t.managers,
                  })
                }
              >
                {t.name}
              </Button>
            ))}
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              request.mutate({
                method: team.id ? "PUT" : "POST",
                url: "/api/pilot/teams" + (team.id ? "/" + team.id : ""),
                data: {
                  name: team.name,
                  members: team.members,
                  managers: team.managers,
                },
              });
            }}
          >
            <label>
              Team name
              <Input
                required
                maxLength={100}
                value={team.name}
                onChange={(e) => setTeam({ ...team, name: e.target.value })}
              />
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              {(["members", "managers"] as const).map((kind) => (
                <fieldset key={kind} className="max-h-56 overflow-auto">
                  <legend>
                    {kind === "members" ? "Employees" : "Managers"}
                  </legend>
                  {users.data
                    ?.filter(
                      (u) =>
                        u.isActive &&
                        (kind === "members" ||
                          roleNames(u.roles).includes("Manager")),
                    )
                    .map((u) => (
                      <label className="block" key={u.id}>
                        <input
                          type="checkbox"
                          checked={team[kind].includes(u.id)}
                          onChange={(e) =>
                            setTeam({
                              ...team,
                              [kind]: e.target.checked
                                ? [...team[kind], u.id]
                                : team[kind].filter((id) => id !== u.id),
                            })
                          }
                        />
                        {u.email}
                      </label>
                    ))}
                </fieldset>
              ))}
            </div>
            <div className="flex gap-3">
              <Button disabled={request.isPending}>
                {team.id ? "Update team" : "Create team"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTeam({ name: "", members: [], managers: [] })}
              >
                New team
              </Button>
            </div>
          </form>
        </Card></div>
        <div className="flex justify-between"><Button variant="outline" disabled={step==='readiness'} onClick={()=>chooseStep(['readiness','people','delivery','content','review'][Math.max(0,['readiness','people','delivery','content','review'].indexOf(step)-1)])}>Previous step</Button><Button disabled={step==='review'} onClick={()=>chooseStep(['readiness','people','delivery','content','review'][Math.min(4,['readiness','people','delivery','content','review'].indexOf(step)+1)])}>Next step</Button></div>
      </div>
    </AppLayout>
  );
}
