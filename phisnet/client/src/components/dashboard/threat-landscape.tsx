import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { ThreatIntelligence } from "@shared/schema";

interface ThreatAnalysis {
  totalThreats: number;
  newThreatsToday: number;
  activeSources: number;
  topThreatTypes: Array<{ type: string; count: number }>;
  recentThreats: ThreatIntelligence[];
}

interface ThreatLandscapeProps {
  threats?: ThreatIntelligence[];
  threatAnalysis?: ThreatAnalysis;
}

export default function ThreatLandscape({ threats, threatAnalysis }: ThreatLandscapeProps) {
  const getThreatLevel = (confidence: number, threatType?: string | null): "high" | "medium" | "low" => {
    if (confidence >= 80 || threatType === 'phishing') return "high";
    if (confidence >= 60) return "medium";
    return "low";
  };

  const getIconColor = (level: string) => {
    switch(level) {
      case "high": return "text-destructive";
      case "medium": return "text-warning";
      case "low": return "text-primary";
      default: return "text-primary";
    }
  };

  const getIconBgColor = (level: string) => {
    switch(level) {
      case "high": return "bg-red-900/30";
      case "medium": return "bg-yellow-900/30";
      case "low": return "bg-blue-900/30";
      default: return "bg-blue-900/30";
    }
  };

  const getThreatIcon = (threatType?: string | null) => {
    switch (threatType) {
      case 'phishing': return <AlertTriangle className="h-4 w-4" />;
      case 'malware': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Current Threat Landscape</CardTitle>
          {threatAnalysis && (
            <div className="flex items-center space-x-2 text-xs">
              <TrendingUp className="h-3 w-3 text-orange-500" />
              <span className="text-muted-foreground">
                {threatAnalysis.newThreatsToday} new today
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {threatAnalysis && (
          <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">
                {threatAnalysis.totalThreats.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Total Threats</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-500">
                {threatAnalysis.activeSources}
              </div>
              <div className="text-xs text-muted-foreground">Active Sources</div>
            </div>
          </div>
        )}
        
        {threats && threats.length > 0 ? (
          <>
            {threats.slice(0, 4).map((threat) => {
              const level = getThreatLevel(threat.confidence || 0, threat.threatType);
              return (
                <div key={threat.id} className="flex items-start space-x-3">
                  <div className={cn("p-1 rounded-md", getIconBgColor(level))}>
                    <div className={cn(getIconColor(level))}>
                      {getThreatIcon(threat.threatType)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {threat.domain || 'Unknown Threat'}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {threat.description || `${threat.threatType} from ${threat.source}`}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(threat.firstSeen), { addSuffix: true })}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                        {threat.threatType}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t">
              <Link href="/threat-landscape">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Full Threat Landscape
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Loading threat intelligence...</p>
            <p className="text-xs">Feed ingestion in progress</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
