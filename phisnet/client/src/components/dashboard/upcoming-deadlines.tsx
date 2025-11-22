import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';

interface Deadline {
  moduleId: number;
  title: string;
  dueDate: Date;
  progress: number | null;
  status: string | null;
  daysUntilDue: number | null;
  urgency: 'high' | 'medium' | 'low' | 'none';
}

interface UpcomingDeadlinesProps {
  deadlines: Deadline[];
}

export function UpcomingDeadlines({ deadlines }: UpcomingDeadlinesProps) {
  const [, setLocation] = useLocation();

  const urgencyColors = {
    high: 'destructive',
    medium: 'default',
    low: 'secondary',
    none: 'outline'
  } as const;

  const urgencyLabels = {
    high: 'Urgent',
    medium: 'Soon',
    low: 'Upcoming',
    none: 'Scheduled'
  };

  if (deadlines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Deadlines
          </CardTitle>
          <CardDescription>No upcoming deadlines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            You're all caught up! No training modules with deadlines in the next 30 days.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Upcoming Deadlines
        </CardTitle>
        <CardDescription>{deadlines.length} module{deadlines.length !== 1 ? 's' : ''} due soon</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deadlines.map((deadline) => (
            <div
              key={deadline.moduleId}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
              onClick={() => setLocation(`/employee/training/${deadline.moduleId}`)}
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-medium text-sm truncate">{deadline.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {deadline.daysUntilDue !== null && (
                      <>
                        {deadline.daysUntilDue === 0 ? 'Due today' : 
                         deadline.daysUntilDue === 1 ? 'Due tomorrow' :
                         `Due in ${deadline.daysUntilDue} days`}
                      </>
                    )}
                  </span>
                  {deadline.progress !== null && (
                    <span className="text-xs text-muted-foreground">
                      • {deadline.progress}% complete
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={urgencyColors[deadline.urgency]} className="flex-shrink-0">
                {urgencyLabels[deadline.urgency]}
              </Badge>
            </div>
          ))}
        </div>

        {deadlines.some(d => d.urgency === 'high') && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-xs text-destructive">
                <span className="font-medium">Action needed:</span>{' '}
                {deadlines.filter(d => d.urgency === 'high').length} urgent deadline{deadlines.filter(d => d.urgency === 'high').length !== 1 ? 's' : ''} approaching.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
