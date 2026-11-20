import { useState } from "react";
import PathTrainingVideo from '@/components/content/path-training-video';
import { useQuery, useMutation } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { apiRequest } from "@/lib/queryClient";
export default function EmployeeLearningPathsPage() {
  const list = useQuery<any[]>({ queryKey: ["/api/employee/learning-paths"] });
  const [selected, setSelected] = useState<number | null>(null),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<Record<string, any>>({}),
    [notice, setNotice] = useState("");
  const detail = useQuery<any>({
    queryKey: ["/api/employee/learning-paths", selected],
    enabled: !!selected,
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/employee/learning-paths/${selected}`)
      ).json(),
  });
  const complete = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "POST",
          `/api/employee/learning-paths/${selected}/steps/${index}`,
          { acknowledged: true, answers },
        )
      ).json(),
    onSuccess: (data) => {
      setNotice(
        data.pathCompleted
          ? "Learning path completed."
          : "Step completed. Choose your next step.",
      );
      setAnswers({});
      void detail.refetch();
      void list.refetch();
    },
    onError: (e) => setNotice(e.message),
  });
  const item = detail.data?.steps[index],
    content = item?.content;
  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex justify-between gap-3">
          <h1 className="text-2xl font-bold">My learning paths</h1>
          <RefreshButton
            onRefresh={() => list.refetch({ throwOnError: true })}
          />
        </div>
        {list.error && <p role="alert">Learning paths could not load.</p>}
        <div className="flex flex-wrap gap-3">
          {list.data?.map((p) => (
            <Button
              variant="outline"
              key={p.id}
              onClick={() => {
                setSelected(p.id);
                setIndex(0);
                setAnswers({});
                setNotice("");
              }}
            >
              {p.name} ({p.completed_steps}/{p.total_steps})
            </Button>
          ))}
        </div>
        {list.data?.length === 0 && <p>No learning paths assigned yet.</p>}
        {detail.error && (
          <p role="alert">This learning assignment is unavailable.</p>
        )}
        {detail.data && (
          <>
            <h2 className="text-xl font-semibold">{detail.data.name}</h2>
            <p>
              Due {new Date(detail.data.due_at).toLocaleDateString()}.{" "}
              {detail.data.completed_at
                ? "Completed"
                : "Complete each step in order."}
            </p>
            <nav
              aria-label="Learning path steps"
              className="flex flex-wrap gap-2"
            >
              {detail.data.steps.map((s: any, i: number) => (
                <Button
                  key={i}
                  variant={index === i ? "default" : "outline"}
                  disabled={s.locked}
                  onClick={() => {
                    setIndex(i);
                    setAnswers({});
                    setNotice("");
                  }}
                >
                  Step {i + 1}: {s.content.title}
                </Button>
              ))}
            </nav>
            {content && (
              <Card className="p-5 space-y-4">
                <h3 className="font-semibold">{content.title}</h3>
                {item.kind === "module" && (
                  <>
                    <p>{content.description}</p>
                    <PathTrainingVideo url={content.video_url}/>
                    <p className="whitespace-pre-wrap">
                      {content.transcript ||
                        "No transcript supplied. Use Training to access the module video."}
                    </p>
                  </>
                )}
                {item.kind === "article" && (
                  <iframe
                    title="Assigned article"
                    className="w-full h-96 border bg-white"
                    sandbox=""
                    srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><body>${content.content}</body>`}
                  />
                )}
                {item.kind === "deck" &&
                  content.cards?.map((c: any) => (
                    <details key={c.id}>
                      <summary>{c.front}</summary>
                      <p>{c.back}</p>
                    </details>
                  ))}
                {item.kind === "quiz" &&
                  content.questions.map((q: any) => (
                    <fieldset key={q.id} className="space-y-2">
                      <legend>{q.question_text}</legend>
                      {q.question_type === "fill_blank" ? (
                        <Input
                          aria-label={q.question_text}
                          value={answers[q.id] || ""}
                          onChange={(e) =>
                            setAnswers({ ...answers, [q.id]: e.target.value })
                          }
                        />
                      ) : (
                        q.options?.map((option: string) => (
                          <label className="block" key={option}>
                            <input
                              type={
                                q.question_type === "multiple_select"
                                  ? "checkbox"
                                  : "radio"
                              }
                              name={"q" + q.id}
                              checked={
                                q.question_type === "multiple_select"
                                  ? (answers[q.id] || []).includes(option)
                                  : answers[q.id] === option
                              }
                              onChange={(e) =>
                                setAnswers({
                                  ...answers,
                                  [q.id]:
                                    q.question_type === "multiple_select"
                                      ? e.target.checked
                                        ? [...(answers[q.id] || []), option]
                                        : (answers[q.id] || []).filter(
                                            (o: string) => o !== option,
                                          )
                                      : option,
                                })
                              }
                            />
                            {option}
                          </label>
                        ))
                      )}
                    </fieldset>
                  ))}
                <Button
                  disabled={
                    item.locked ||
                    complete.isPending ||
                    detail.data.completed.some((s: any) => s.ordinal === index)
                  }
                  onClick={() => complete.mutate()}
                >
                  {item.kind === "quiz"
                    ? "Submit path assessment"
                    : "I have reviewed this step"}
                </Button>
              </Card>
            )}
          </>
        )}
        {notice && <p role="status">{notice}</p>}
      </div>
    </AppLayout>
  );
}
