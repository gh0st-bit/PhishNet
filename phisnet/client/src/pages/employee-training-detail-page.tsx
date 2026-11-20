import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useState, useRef } from "react";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
export default function EmployeeTrainingDetailPage() {
  const [, params] = useRoute("/employee/training/:id"),
    id = Number(params?.id),
    cache = useQueryClient(),
    video = useRef<HTMLVideoElement>(null);
  const [read, setRead] = useState(false),
    [notice, setNotice] = useState("");
  const q = useQuery<any>({
    queryKey: [`/api/employee/training/${id}`],
    enabled: !!id,
  });
  const save = useMutation({
    mutationFn: async (complete: boolean) =>
      (
        await apiRequest("POST", `/api/employee/training/${id}/progress`, {
          progressPercentage: complete
            ? 100
            : Math.max(q.data?.progress?.progressPercentage || 0, 10),
          videoTimestamp: Math.floor(
            video.current?.currentTime || q.data?.progress?.videoTimestamp || 0,
          ),
          status: complete ? "completed" : "in_progress",
        })
      ).json(),
    onSuccess: (_d, complete) => {
      setNotice(
        complete
          ? "Learning completed. Your progress is saved."
          : "Progress saved. You can continue later.",
      );
      void q.refetch();
      void cache.invalidateQueries({ queryKey: ["/api/employee/training"] });
      void cache.invalidateQueries({
        queryKey: ["/api/employee/dashboard/analytics"],
      });
    },
    onError: (e) => setNotice(e.message),
  });
  let youtube: string | undefined;
  try {
    const u = new URL(q.data?.module?.videoUrl || "");
    if (["youtube.com", "www.youtube.com", "youtu.be"].includes(u.hostname)) {
      const key =
        u.hostname === "youtu.be"
          ? u.pathname.slice(1)
          : u.searchParams.get("v") || u.pathname.split("/").at(-1);
      if (key && /^[A-Za-z0-9_-]{6,20}$/.test(key))
        youtube = "https://www.youtube-nocookie.com/embed/" + key;
    }
  } catch {}
  const source = q.data?.module?.videoUrl;
  const safeSource =
    typeof source === "string" && /^(https?:\/\/|\/[^/])/.test(source);
  return (
    <AppLayout>
      <div className="space-y-5">
        <Link href="/employee/training" className="underline">
          Back to training
        </Link>
        {q.isLoading && <p role="status">Loading learning...</p>}
        {q.error && <p role="alert">Learning could not be loaded.</p>}
        {q.data && (
          <>
            <h1 className="text-2xl font-bold">{q.data.module.title}</h1>
            <p>{q.data.module.description}</p>
            <p>Progress: {q.data.progress?.progressPercentage || 0}%</p>
            {youtube ? (
              <iframe
                title="Training video"
                className="w-full aspect-video"
                src={youtube}
                allow="fullscreen"
              />
            ) : safeSource ? (
              <video
                ref={video}
                className="w-full max-h-96"
                controls
                src={source}
                onLoadedMetadata={() => {
                  if (video.current)
                    video.current.currentTime =
                      q.data.progress?.videoTimestamp || 0;
                }}
              />
            ) : (
              <p>
                No video is required for this lesson. Read the transcript below.
              </p>
            )}
            <Card className="p-5">
              <h2 className="font-semibold">Lesson transcript</h2>
              <div className="whitespace-pre-wrap mt-3">
                {q.data.module.transcript ||
                  "A transcript has not been supplied for this module."}
              </div>
            </Card>
            <p className="text-sm">
              Assigned learning keeps its captured content version. Completion
              records your acknowledgement; it is not proof of watching a video.
            </p>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={read}
                onChange={(e) => setRead(e.target.checked)}
              />
              I have completed and understood this lesson.
            </label>
            <div className="flex gap-3">
              <Button
                variant="outline"
                disabled={
                  save.isPending || q.data.progress?.status === "completed"
                }
                onClick={() => save.mutate(false)}
              >
                Save progress
              </Button>
              <Button
                disabled={
                  !read ||
                  save.isPending ||
                  q.data.progress?.status === "completed"
                }
                onClick={() => save.mutate(true)}
              >
                Mark lesson complete
              </Button>
            </div>
            {notice && <p role="status">{notice}</p>}
          </>
        )}
      </div>
    </AppLayout>
  );
}
