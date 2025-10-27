import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  User, 
  Briefcase, 
  Mail, 
  Loader2, 
  Sparkles,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ContactInfo {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl?: string;
}

interface GeneratedProfile {
  summary: string;
  interests: string[];
  workStyle: string;
  vulnerabilities: string[];
  recommendedApproach: string;
  profileData: any;
}

interface GeneratedPretext {
  pretextType: string;
  subject: string;
  content: string;
  tone: string;
  urgency: string;
  personalization: any;
}

export function AIProfileGenerator() {
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    email: '',
    firstName: '',
    lastName: '',
    title: '',
    company: '',
    linkedinUrl: ''
  });
  
  const [generatedProfile, setGeneratedProfile] = useState<GeneratedProfile | null>(null);
  const [generatedPretext, setGeneratedPretext] = useState<GeneratedPretext | null>(null);

  // Generate AI profile mutation
  const generateProfileMutation = useMutation({
    mutationFn: async (data: ContactInfo) => {
      const response = await fetch('/api/reconnaissance/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to generate profile');
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedProfile(data.profile);
      toast({
        title: 'Profile Generated!',
        description: 'AI has analyzed the contact and generated a behavioral profile.'
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

  // Generate pretext mutation
  const generatePretextMutation = useMutation({
    mutationFn: async () => {
      if (!generatedProfile) throw new Error('Generate a profile first');
      
      const response = await fetch('/api/reconnaissance/generate-pretext', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactInfo,
          profile: generatedProfile,
          pretextType: 'business-urgent'
        })
      });
      if (!response.ok) throw new Error('Failed to generate pretext');
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedPretext(data.pretext);
      toast({
        title: 'Pretext Generated!',
        description: 'AI has crafted a personalized phishing email based on the profile.'
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

  const handleInputChange = (field: keyof ContactInfo, value: string) => {
    setContactInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateProfile = () => {
    if (!contactInfo.email || !contactInfo.firstName || !contactInfo.company) {
      toast({
        title: 'Missing Information',
        description: 'Please provide at least email, first name, and company.',
        variant: 'destructive'
      });
      return;
    }
    
    generateProfileMutation.mutate(contactInfo);
  };

  const isFormValid = contactInfo.email && contactInfo.firstName && contactInfo.company;

  return (
    <div className="space-y-6">
      {/* Contact Information Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Target Contact Information
          </CardTitle>
          <CardDescription>
            Enter information about the target contact for AI analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={contactInfo.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={contactInfo.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                value={contactInfo.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                placeholder="Senior Manager"
                value={contactInfo.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                placeholder="Example Corp"
                value={contactInfo.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="linkedinUrl">LinkedIn URL (Optional)</Label>
              <Input
                id="linkedinUrl"
                placeholder="https://linkedin.com/in/johndoe"
                value={contactInfo.linkedinUrl}
                onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
              />
            </div>
          </div>
          
          <Button
            onClick={handleGenerateProfile}
            disabled={!isFormValid || generateProfileMutation.isPending}
            className="w-full"
          >
            {generateProfileMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating AI Profile...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4 mr-2" />
                Generate AI Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Profile */}
      {generatedProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI-Generated Profile
            </CardTitle>
            <CardDescription>
              Behavioral analysis and recommendations from Google Gemini AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">Summary</h4>
              <p className="text-muted-foreground text-sm">{generatedProfile.summary}</p>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Interests</h4>
              <div className="flex flex-wrap gap-1">
                {generatedProfile.interests?.map((interest, index) => (
                  <Badge key={index} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Work Style</h4>
              <p className="text-muted-foreground text-sm">{generatedProfile.workStyle}</p>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Potential Vulnerabilities</h4>
              <div className="space-y-1">
                {generatedProfile.vulnerabilities?.map((vuln, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-orange-700">
                    <AlertCircle className="w-3 h-3" />
                    {vuln}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Recommended Approach</h4>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {generatedProfile.recommendedApproach}
                </AlertDescription>
              </Alert>
            </div>

            <Button
              onClick={() => generatePretextMutation.mutate()}
              disabled={generatePretextMutation.isPending}
              className="w-full mt-4"
            >
              {generatePretextMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Personalized Email...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Generate Personalized Phishing Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generated Pretext */}
      {generatedPretext && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Generated Phishing Email
            </CardTitle>
            <CardDescription>
              Personalized email crafted based on the AI profile analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email Type</Label>
                <Badge>{generatedPretext.pretextType}</Badge>
              </div>
              <div>
                <Label>Tone</Label>
                <Badge variant="outline">{generatedPretext.tone}</Badge>
              </div>
            </div>

            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={generatedPretext.subject}
                readOnly
                className="font-medium"
              />
            </div>

            <div>
              <Label htmlFor="content">Email Content</Label>
              <Textarea
                id="content"
                value={generatedPretext.content}
                readOnly
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Note:</strong> This email is generated for authorized phishing simulations only. 
                Ensure proper approval and scope before use in any security testing.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AIProfileGenerator;