import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  suffix?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  negative?: boolean;
}

export default function StatCard({
  title,
  value,
  change = 0,
  suffix = "from last month",
  icon,
  iconBgColor,
  iconColor,
  negative = false
}: StatCardProps) {
  const isPositiveChange = change > 0;
  const changeText = isPositiveChange ? `+${change}%` : `${change}%`;
  
  // For phishing success rate, a positive change is bad
  const changeColor = negative
    ? isPositiveChange ? "text-destructive" : "text-success"
    : isPositiveChange ? "text-success" : "text-destructive";

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 lg:p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl lg:text-2xl font-semibold text-foreground mt-1">{value}</h3>
          </div>
          <div className={cn("p-1.5 sm:p-2 rounded-md shrink-0 ml-2", iconBgColor)}>
            <div className={cn(iconColor, "[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5")}>{icon}</div>
          </div>
        </div>
        {typeof change === 'number' && (
          <div className="mt-1.5 sm:mt-2">
            <span className={cn("text-[10px] sm:text-xs flex items-center", changeColor)}>
              {isPositiveChange ? (
                <ArrowUp className="mr-0.5 sm:mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
              ) : (
                <ArrowDown className="mr-0.5 sm:mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
              )}
              {changeText} <span className="hidden sm:inline">{suffix}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
