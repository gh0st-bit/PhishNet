// Import necessary components and icons
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Import Progress component for displaying progress bars
import { Progress } from "@/components/ui/progress";
// Import icons from lucide-react
import { Shield, Lock, Smartphone } from "lucide-react";

// Define the structure of a training item
interface Training {
  id: number;
  name: string;
  progress: number;
  icon: "shield" | "lock" | "smartphone";
}
// Define the props for the SecurityTraining component
interface SecurityTrainingProps {
  trainings?: Training[];
}
// SecurityTraining component to display security training progress
export default function SecurityTraining({ trainings }: SecurityTrainingProps) {
  const getIcon = (iconType: string) => {
    switch(iconType) {
      case "shield": return <Shield className="h-4 w-4 text-primary" />;
      case "lock": return <Lock className="h-4 w-4 text-primary" />;
      case "smartphone": return <Smartphone className="h-4 w-4 text-primary" />;
      default: return <Shield className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Training</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {trainings && trainings.length > 0 ? (
          trainings.map((training) => (
            <div key={training.id} className="flex items-start space-x-3">
              <div className="p-1 bg-blue-900/30 rounded-md">
                {getIcon(training.icon)}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">{training.name}</h4>
                <div className="flex items-center mt-1">
                  <Progress className="h-2 flex-1" value={training.progress} />
                  <span className="text-xs text-muted-foreground ml-2">
                    {training.progress}%
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            No training data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
