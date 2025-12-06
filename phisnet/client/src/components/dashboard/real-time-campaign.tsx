import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// Events emitted by the backend under the 
// `campaign.email_opened`, `campaign.link_clicked`, `campaign.form_submitted` types
interface CampaignEvent {
  type: string;
  campaignId?: number;
  targetId?: number;
  timestamp?: string | number;
  [key: string]: any;
}

// RealTimeCampaignWidget component
export default function RealTimeCampaignWidget() {
  const { user } = useAuth();
  const orgId = user?.organizationId ?? null;

  const [connected, setConnected] = useState(false);
  const [opens, setOpens] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [submissions, setSubmissions] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const namespace = useMemo(() => "/campaigns", []);

  useEffect(() => {
    if (!orgId) return;

    // Connect to current origin with campaigns namespace
    const socket = io(namespace, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["polling", "websocket"],
    });

    // Save socket reference
    socketRef.current = socket;

    // Handle socket events
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-org", orgId);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Handle incoming campaign events
    socket.on("event", (evt: CampaignEvent) => {
      if (!evt || !evt.type) return;
      if (evt.type === "campaign.email_opened") setOpens((v) => v + 1);
      else if (evt.type === "campaign.link_clicked") setClicks((v) => v + 1);
      else if (evt.type === "campaign.form_submitted") setSubmissions((v) => v + 1);
    });

    // Handle connection errors
    socket.on("connect_error", () => setConnected(false));

    return () => {
      try {
        socket.off("event");
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [orgId, namespace]);

  return (
    <Card>
      <CardHeader className="pb-3 flex items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Real-Time Campaign
        </CardTitle>
        <Badge variant={connected ? "default" : "secondary"}>
          {connected ? "Live" : "Offline"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Opens</p>
            <p className="text-2xl font-semibold">{opens}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="text-2xl font-semibold">{clicks}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submissions</p>
            <p className="text-2xl font-semibold">{submissions}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Counts reset on reload. Aggregates current live events for your organization.
        </p>
      </CardContent>
    </Card>
  );
}
