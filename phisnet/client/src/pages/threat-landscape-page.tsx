import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Shield, 
  Search, 
  ExternalLink, 
  TrendingUp,
  Activity,
  Globe,
  Clock,
  Filter,
  RefreshCw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { ThreatIntelligence } from "@shared/schema";

interface ThreatAnalysis {
  totalThreats: number;
  newThreatsToday: number;
  activeSources: number;
  topThreatTypes: Array<{ type: string; count: number }>;
  recentThreats: ThreatIntelligence[];
  threatTrends: Array<{ date: string; count: number; type: string }>;
}

function ThreatStats({ analysis }: { analysis: ThreatAnalysis }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Threats</p>
              <p className="text-2xl font-bold">{analysis.totalThreats.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">New Today</p>
              <p className="text-2xl font-bold text-orange-500">{analysis.newThreatsToday}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active Sources</p>
              <p className="text-2xl font-bold">{analysis.activeSources}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Top Threat</p>
              <p className="text-lg font-bold capitalize">
                {analysis.topThreatTypes[0]?.type || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ThreatTypeChart({ threatTypes }: { threatTypes: Array<{ type: string; count: number }> }) {
  if (threatTypes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Threat Types Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No threat data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...threatTypes.map(t => t.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Threat Types Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {threatTypes.slice(0, 5).map((threat, index) => (
          <div key={threat.type} className="flex items-center space-x-4">
            <div className="w-20 text-sm capitalize font-medium">
              {threat.type}
            </div>
            <div className="flex-1">
              <div className="h-4 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full",
                    index === 0 ? "bg-red-500" :
                    index === 1 ? "bg-orange-500" :
                    index === 2 ? "bg-yellow-500" :
                    "bg-blue-500"
                  )}
                  style={{ width: `${(threat.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
            <div className="w-16 text-sm text-right">
              {threat.count.toLocaleString()}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ThreatTable({ threats }: { threats: ThreatIntelligence[] }) {
  const getThreatLevelColor = (confidence: number, threatType?: string | null) => {
    if (confidence >= 80 || threatType === 'phishing') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  };

  const getThreatIcon = (threatType?: string | null) => {
    switch (threatType) {
      case 'phishing': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'malware': return <Shield className="h-4 w-4 text-orange-500" />;
      default: return <Globe className="h-4 w-4 text-blue-500" />;
    }
  };

  if (threats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Threats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No threats found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Threats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {threats.map((threat) => (
            <div key={threat.id} className="flex items-start space-x-4 p-4 border rounded-lg">
              <div className="mt-1">
                {getThreatIcon(threat.threatType)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="font-medium truncate">
                    {threat.domain || threat.url || 'Unknown'}
                  </h4>
                  <Badge className={getThreatLevelColor(threat.confidence || 0, threat.threatType)}>
                    {threat.confidence}% confidence
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {threat.threatType || 'unknown'}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {threat.description || 'No description available'}
                </p>
                
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(threat.firstSeen), { addSuffix: true })}
                    </span>
                  </span>
                  <span className="capitalize">Source: {threat.source}</span>
                  {threat.malwareFamily && (
                    <span>Family: {threat.malwareFamily}</span>
                  )}
                </div>
                
                {threat.url && (
                  <div className="mt-2">
                    <a 
                      href={threat.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center space-x-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate max-w-96">{threat.url}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ThreatSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ThreatIntelligence[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/threat-intelligence/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Threats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-4">
          <Input
            placeholder="Search by domain, URL, or malware family..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isSearching || searchQuery.length < 3}>
            {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <h5 className="font-medium">Search Results ({searchResults.length})</h5>
            <ThreatTable threats={searchResults} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ThreatLandscapePage() {
  // Fetch threat analysis
  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<ThreatAnalysis>({
    queryKey: ['threat-analysis'],
    queryFn: async () => {
      const response = await fetch('/api/threat-intelligence/analysis');
      if (!response.ok) throw new Error('Failed to fetch threat analysis');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Fetch recent threats
  const { data: threats = [], isLoading: threatsLoading, refetch: refetchThreats } = useQuery<ThreatIntelligence[]>({
    queryKey: ['recent-threats'],
    queryFn: async () => {
      const response = await fetch('/api/threat-intelligence/threats?limit=50');
      if (!response.ok) throw new Error('Failed to fetch threats');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const handleRefresh = () => {
    refetchAnalysis();
    refetchThreats();
  };

  if (analysisLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading threat intelligence...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Threat Landscape</h1>
            <p className="text-muted-foreground">
              Real-time threat intelligence from multiple security feeds
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {analysis && <ThreatStats analysis={analysis} />}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="threats">Recent Threats</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {analysis && <ThreatTypeChart threatTypes={analysis.topThreatTypes} />}
              <Card>
                <CardHeader>
                  <CardTitle>Feed Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>URLhaus (Abuse.ch)</span>
                      </span>
                      <Badge variant="outline">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>OpenPhish</span>
                      </span>
                      <Badge variant="outline">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Malware Domain List</span>
                      </span>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="threats">
            {threatsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Loading threats...</p>
              </div>
            ) : (
              <ThreatTable threats={threats} />
            )}
          </TabsContent>

          <TabsContent value="search">
            <ThreatSearch />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}