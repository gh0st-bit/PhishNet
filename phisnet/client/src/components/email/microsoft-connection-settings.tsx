import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
export default function MicrosoftConnectionSettings() {
  const profiles = useQuery<any[]>({ queryKey: ["/api/smtp-profiles"] }),
    q = useQuery<any>({ queryKey: ["/api/pilot/microsoft"] });
  const [form, setForm] = useState({
      profileId: "",
      tenantId: "",
      clientId: "",
      clientSecret: "",
      enabled: false,
    }),
    [notice, setNotice] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { profileId, clientSecret, ...rest } = form;
      return (
        await apiRequest("PUT", `/api/pilot/microsoft/${profileId}`, {
          ...rest,
          ...(clientSecret ? { clientSecret } : {}),
        })
      ).json();
    },
    onSuccess: () => {
      setForm({ ...form, clientSecret: "" });
      setNotice("Connection saved. No email was sent.");
      void q.refetch();
    },
    onError: (e) => setNotice(e.message),
  });
  const verify = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "POST",
          `/api/pilot/microsoft/${form.profileId}/verify`,
        )
      ).json(),
    onSuccess: (d) => setNotice(d.message),
    onError: (e) => setNotice(e.message),
  });
  return (
    <Card className="p-5 space-y-3">
      <h2 className="text-xl font-semibold">Microsoft 365 connection</h2>
      <p>
        Create a sending profile first, then configure its Microsoft application
        credentials. Use a dedicated sender mailbox and mailbox-scoped
        permissions. External connections are{" "}
        {q.data?.externalEnabled ? "enabled" : "disabled"} in this environment.
      </p>
      {(profiles.error || q.error) && (
        <p role="alert">Connection settings could not load.</p>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Sending profile
          <select
            className="block border bg-background p-2"
            required
            value={form.profileId}
            onChange={(e) => {
              const prior = q.data?.connections.find(
                (c: any) => String(c.profile_id) === e.target.value,
              );
              setForm({
                profileId: e.target.value,
                tenantId: prior?.tenant_id || "",
                clientId: prior?.client_id || "",
                clientSecret: "",
                enabled: prior?.enabled || false,
              });
            }}
          >
            <option value="">Choose a profile</option>
            {profiles.data
              ?.filter((p) => p.deliveryMode === "tenant_smtp")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        {(["tenantId", "clientId", "clientSecret"] as const).map((key) => (
          <label className="block" key={key}>
            {key === "tenantId"
              ? "Microsoft tenant ID"
              : key === "clientId"
                ? "Application client ID"
                : "Client secret (leave blank to keep saved secret)"}
            <Input
              required={key !== "clientSecret"}
              type={key === "clientSecret" ? "password" : "text"}
              autoComplete="off"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Use OAuth for this profile
        </label>
        <div className="flex gap-3">
          <Button disabled={save.isPending || !form.profileId}>
            Save Microsoft connection
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              !q.data?.externalEnabled || !form.profileId || verify.isPending
            }
            onClick={() => verify.mutate()}
          >
            Verify SMTP authentication
          </Button>
        </div>
      </form>
      {notice && <p role="status">{notice}</p>}
      <p className="text-sm">
        Verification authenticates to Microsoft; it does not send a message or
        prove delivery to the inbox.
      </p>
    </Card>
  );
}
