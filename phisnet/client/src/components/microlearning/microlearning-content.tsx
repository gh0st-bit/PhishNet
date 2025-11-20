import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, BookOpen, ExternalLink } from "lucide-react";

interface MicrolearningProps {
  title: string;
  content: string;
  tips?: string[];
  remediationLinks?: Array<{ title: string; url: string }>;
  onComplete?: () => void;
}

export function MicrolearningContent({ 
  title, 
  content, 
  tips = [], 
  remediationLinks = [],
  onComplete 
}: MicrolearningProps) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-900 font-semibold">You've Been Phished!</AlertTitle>
        <AlertDescription className="text-orange-800">
          This was a simulated phishing attack. Let's learn how to spot these attempts in the future.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>Understanding what happened and how to protect yourself</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-muted-foreground whitespace-pre-wrap">{content}</p>
          </div>

          {tips.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                How to Spot Phishing Attempts
              </h3>
              <ul className="space-y-2 text-sm">
                {tips.map((tip, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span className="text-muted-foreground">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {remediationLinks.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold text-sm">Additional Training Resources</h3>
              <div className="space-y-2">
                {remediationLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors group"
                  >
                    <span className="text-sm font-medium group-hover:text-primary">
                      {link.title}
                    </span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {onComplete && (
            <div className="pt-4">
              <Button onClick={onComplete} className="w-full">
                I Understand
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-900">Remember These Key Points:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Always verify sender email addresses carefully</li>
                <li>• Hover over links before clicking to see the real destination</li>
                <li>• Be suspicious of urgent requests or threats</li>
                <li>• Never enter credentials on unfamiliar websites</li>
                <li>• When in doubt, contact IT security</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
