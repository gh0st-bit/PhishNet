import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
export default function EmployeeReportPage() {
  const params = new URLSearchParams(window.location.search);
  const [messageKey, setKey] = useState(params.get("messageKey") || ""),
    [subject, setSubject] = useState(params.get("subject") || "");
  const q = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/employee/report-message", {
          messageKey,
          subject,
        })
      ).json(),
  });
  return (
    <AppLayout>
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-bold">Report suspicious message</h1>
        <p>
          Report a message to your organization’s security team. Only matched
          messages sent to your account affect simulation statistics. Do not
          paste passwords or the message body.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            q.mutate();
          }}
        >
          <label>
            Internet Message-ID
            <Input
              required
              maxLength={500}
              value={messageKey}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <label>
            Subject
            <Input
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <Button disabled={q.isPending || !messageKey.trim()}>
            Submit message report
          </Button>
        </form>
        {q.error && <p role="alert">{q.error.message}</p>}
        {q.data && <p role="status">{q.data.message}</p>}
      </div>
    </AppLayout>
  );
}
