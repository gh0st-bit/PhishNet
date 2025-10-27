import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCampaigns } from '@/hooks/useApi';
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Users, 
  Globe, 
  Mail, 
  Bot, 
  Download, 
  Eye, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Play,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AIProfileGenerator from '@/components/reconnaissance/ai-profile-generator';

interface ReconJob {
  id: string;
  campaignId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalSteps: number;
  currentStep: string;
  startedAt: string;
  completedAt?: string;
  results?: any;
  errorMessage?: string;
}

interface ReconResults {
  domains: any[];
  contacts: any[];
  profiles: any[];
  pretexts: any[];
}

interface Campaign {
  id: number;
  name: string;
  status: string;
}

export default function ReconnaissancePage() {
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [domains, setDomains] = useState<string[]>(['']);
  const [testDomain, setTestDomain] = useState('');
  const [testContact, setTestContact] = useState({ name: '', company: '', domain: '' });
  const [activeJob, setActiveJob] = useState<ReconJob | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [] } = useCampaigns();

  // Fetch reconnaissance results for selected campaign
  const { data: results, refetch: refetchResults } = useQuery({
    queryKey: ['reconnaissance-results', selectedCampaign],
    queryFn: () => 
      selectedCampaign 
        ? fetch(`/api/reconnaissance/results/${selectedCampaign}`).then(res => res.json())
        : Promise.resolve(null),
    enabled: !!selectedCampaign
  });

  // Start reconnaissance mutation
  const startReconMutation = useMutation({
    mutationFn: async (data: { campaignId: number; domains: string[] }) => {
      const response = await fetch('/api/reconnaissance/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to start reconnaissance');
      return response.json();
    },
    onSuccess: (data) => {
      setActiveJob(data.job);
      toast({
        title: 'Reconnaissance Started',
        description: 'Domain reconnaissance is now running...'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Test domain mutation
  const testDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const response = await fetch('/api/reconnaissance/test-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      if (!response.ok) throw new Error('Failed to test domain');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Domain Test Complete',
        description: `Found ${data.data.subdomains?.length || 0} subdomains and ${data.data.emailFormats?.length || 0} email patterns`
      });
    }
  });

  // Test contact mutation
  const testContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      const response = await fetch('/api/reconnaissance/test-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData)
      });
      if (!response.ok) throw new Error('Failed to test contact search');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Contact Search Complete',
        description: `Found ${data.data.contacts?.length || 0} contacts`
      });
    }
  });

  // Poll job status
  useEffect(() => {
    if (activeJob && activeJob.status === 'running') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/reconnaissance/status/${activeJob.id}`);
          const jobData = await response.json();
          
          if (jobData.success) {
            setActiveJob(jobData.data);
            
            if (jobData.data.status === 'completed' || jobData.data.status === 'failed') {
              clearInterval(interval);
              refetchResults();
              
              if (jobData.data.status === 'completed') {
                toast({
                  title: 'Reconnaissance Complete!',
                  description: 'All reconnaissance tasks have been completed successfully.'
                });
              }
            }
          }
        } catch (error) {
          console.error('Error polling job status:', error);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [activeJob, refetchResults]);

  const handleAddDomain = () => {
    setDomains([...domains, '']);
  };

  const handleRemoveDomain = (index: number) => {
    const newDomains = domains.filter((_, i) => i !== index);
    setDomains(newDomains.length === 0 ? [''] : newDomains);
  };

  const handleDomainChange = (index: number, value: string) => {
    const newDomains = [...domains];
    newDomains[index] = value;
    setDomains(newDomains);
  };

  const handleStartReconnaissance = () => {
    if (!selectedCampaign) {
      toast({
        title: 'Error',
        description: 'Please select a campaign first',
        variant: 'destructive'
      });
      return;
    }

    const validDomains = domains.filter(d => d.trim());
    if (validDomains.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter at least one domain',
        variant: 'destructive'
      });
      return;
    }

    startReconMutation.mutate({
      campaignId: selectedCampaign,
      domains: validDomains
    });
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="w-6 h-6" />
            Reconnaissance
          </h1>
          <p className="text-muted-foreground mt-1">
            Advanced reconnaissance and intelligence gathering for phishing campaigns
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 bg-muted p-1 h-auto">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="start" 
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Start Recon
            </TabsTrigger>
            <TabsTrigger 
              value="results" 
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Results
            </TabsTrigger>
            <TabsTrigger 
              value="testing" 
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Testing
            </TabsTrigger>
            <TabsTrigger 
              value="ai-tools" 
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              AI Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activeJob && activeJob.status === 'running' ? '1' : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Currently running reconnaissance jobs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Discovered Contacts</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {results?.contacts?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total contacts found
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AI Profiles</CardTitle>
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {results?.profiles?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI-generated profiles
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Job Status */}
            {activeJob && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {activeJob.status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {activeJob.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {activeJob.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    Reconnaissance Job Status
                  </CardTitle>
                  <CardDescription>
                    Campaign ID: {activeJob.campaignId} • Started: {new Date(activeJob.startedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span>{activeJob.progress}% ({activeJob.progress}/{activeJob.totalSteps})</span>
                      </div>
                      <Progress value={activeJob.progress} className="w-full" />
                    </div>
                    
                    <div>
                      <Badge variant={activeJob.status === 'running' ? 'default' : 
                                     activeJob.status === 'completed' ? 'success' : 'destructive'}>
                        {activeJob.status.charAt(0).toUpperCase() + activeJob.status.slice(1)}
                      </Badge>
                    </div>
                    
                    {activeJob.currentStep && (
                      <p className="text-sm text-muted-foreground">
                        Current Step: {activeJob.currentStep}
                      </p>
                    )}
                    
                    {activeJob.errorMessage && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {activeJob.errorMessage}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="start">
            <Card>
              <CardHeader>
                <CardTitle>Start New Reconnaissance</CardTitle>
                <CardDescription>
                  Begin domain reconnaissance and contact discovery for a campaign
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="campaign">Select Campaign</Label>
                  <Select
                    value={selectedCampaign?.toString() || ''}
                    onValueChange={(value) => setSelectedCampaign(value ? Number(value) : null)}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select a campaign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns?.map((campaign: Campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Target Domains</Label>
                  <div className="space-y-2 mt-2">
                    {domains.map((domain, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="example.com"
                          value={domain}
                          onChange={(e) => handleDomainChange(index, e.target.value)}
                        />
                        {domains.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveDomain(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" onClick={handleAddDomain}>
                      Add Another Domain
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleStartReconnaissance}
                  disabled={startReconMutation.isPending || !selectedCampaign}
                  className="w-full"
                >
                  {startReconMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting Reconnaissance...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Reconnaissance
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <div className="space-y-6">
              {!selectedCampaign ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">
                      Please select a campaign to view reconnaissance results
                    </p>
                  </CardContent>
                </Card>
              ) : results ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Globe className="w-5 h-5" />
                          Discovered Domains
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {results.domains?.map((domain: any, index: number) => (
                            <div key={index} className="p-3 bg-muted/50 rounded-lg">
                              <div className="font-medium">{domain.domain}</div>
                              <div className="text-sm text-muted-foreground">
                                {domain.subdomains?.length || 0} subdomains • 
                                {domain.emailFormats?.length || 0} email formats
                              </div>
                            </div>
                          )) || <p className="text-muted-foreground">No domains discovered yet</p>}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Discovered Contacts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {results.contacts?.map((contact: any, index: number) => (
                            <div key={index} className="p-3 bg-muted/50 rounded-lg">
                              <div className="font-medium">
                                {contact.firstName} {contact.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {contact.email} • {contact.title} • {contact.source}
                              </div>
                            </div>
                          )) || <p className="text-muted-foreground">No contacts discovered yet</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        AI-Generated Profiles & Pretexts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {results.profiles?.map((profile: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="font-medium mb-2">
                              Profile for Contact ID: {profile.contactId}
                            </div>
                            <div className="text-sm text-muted-foreground mb-3">
                              {profile.summary}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <strong>Interests:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {profile.interests?.map((interest: string, i: number) => (
                                    <Badge key={i} variant="secondary">
                                      {interest}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <strong>Recommended Approach:</strong>
                                <p className="text-sm mt-1">{profile.recommendedApproach}</p>
                              </div>
                            </div>
                          </div>
                        )) || <p className="text-muted-foreground">No AI profiles generated yet</p>}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      Loading reconnaissance results...
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="testing">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Domain Discovery</CardTitle>
                  <CardDescription>
                    Test domain reconnaissance on a single domain
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="testDomain">Domain</Label>
                    <Input
                      id="testDomain"
                      placeholder="example.com"
                      value={testDomain}
                      onChange={(e) => setTestDomain(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => testDomainMutation.mutate(testDomain)}
                    disabled={testDomainMutation.isPending || !testDomain}
                    className="w-full"
                  >
                    {testDomainMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Domain Discovery'
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Test Contact Search</CardTitle>
                  <CardDescription>
                    Test contact discovery using free API providers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="testContactName">Full Name</Label>
                    <Input
                      id="testContactName"
                      placeholder="John Doe"
                      value={testContact.name}
                      onChange={(e) => setTestContact({...testContact, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="testContactCompany">Company</Label>
                    <Input
                      id="testContactCompany"
                      placeholder="Example Corp"
                      value={testContact.company}
                      onChange={(e) => setTestContact({...testContact, company: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="testContactDomain">Domain</Label>
                    <Input
                      id="testContactDomain"
                      placeholder="example.com"
                      value={testContact.domain}
                      onChange={(e) => setTestContact({...testContact, domain: e.target.value})}
                    />
                  </div>
                  <Button
                    onClick={() => testContactMutation.mutate(testContact)}
                    disabled={testContactMutation.isPending || !testContact.domain}
                    className="w-full"
                  >
                    {testContactMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Contact Search'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        <TabsContent value="ai-tools">
          <AIProfileGenerator />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}