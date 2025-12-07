import AppLayout from "@/components/layout/app-layout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminCredentialCapturesPage() {
  const { toast } = useToast();
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [templateFilter, setTemplateFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [revealPasswords, setRevealPasswords] = useState<Record<number, boolean>>({});

  // Fetch credential captures
  const { data: capturesData, isLoading } = useQuery({
    queryKey: ["/api/admin/credential-captures", campaignFilter, templateFilter, page],
    queryFn: async () => {
      let url = `/api/admin/credential-captures?page=${page}&limit=20`;
      if (campaignFilter) url += `&campaignId=${campaignFilter}`;
      if (templateFilter) url += `&templateId=${templateFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch captures");
      return res.json();
    },
  });

  // Fetch campaigns for filter dropdown
  const { data: campaignsData } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  const captures = capturesData?.data || [];
  const pagination = capturesData?.pagination || { page: 1, limit: 20, total: 0, pages: 1 };

  const toggleReveal = (id: number) => {
    setRevealPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const maskPassword = (password: string) => {
    return "•".repeat(Math.min(password.length, 12));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Credential Captures</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor credentials submitted during phishing simulations
            </p>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Campaign</label>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All campaigns</SelectItem>
                  {campaignsData?.map((campaign: any) => (
                    <SelectItem key={campaign.id} value={campaign.id.toString()}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Total Captures</label>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCampaignFilter("");
                  setTemplateFilter("");
                  setPage(1);
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : captures.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No credential captures yet. Start a campaign and wait for submissions.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Campaign</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Target Email</TableHead>
                  <TableHead>Submitted Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Submitted At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {captures.map((capture: any) => (
                  <TableRow key={capture.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{capture.campaignName}</TableCell>
                    <TableCell className="text-sm">{capture.templateName}</TableCell>
                    <TableCell className="text-sm">
                      {capture.targetEmail || <Badge variant="secondary">Unknown</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{capture.email}</span>
                        <button
                          onClick={() => copyToClipboard(capture.email)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{capture.username}</span>
                        <button
                          onClick={() => copyToClipboard(capture.username)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {revealPasswords[capture.id] ? capture.password : maskPassword(capture.password)}
                        </span>
                        <button
                          onClick={() => toggleReveal(capture.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {revealPasswords[capture.id] ? (
                            <EyeOff className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Eye className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(capture.password)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {capture.ip || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(capture.submittedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page} of {pagination.pages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={page === pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
