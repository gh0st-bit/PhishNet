import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface TrendData {
  date: string;
  modulesCompleted: number;
  quizzesPassed: number;
  pointsEarned: number;
}

interface LearningTrendChartProps {
  data: TrendData[];
  title?: string;
  description?: string;
}

export function LearningTrendChart({ 
  data = [], 
  title = "Learning Activity Trends",
  description = "Your progress over the last 30 days"
}: LearningTrendChartProps) {
  // Format date for display
  const formattedData = data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card className="p-3 sm:p-4 lg:p-5">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="truncate">{title}</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-[10px] sm:text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-[10px] sm:text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Line 
              type="monotone" 
              dataKey="modulesCompleted" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Modules Completed"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="quizzesPassed" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              name="Quizzes Passed"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="pointsEarned" 
              stroke="hsl(var(--chart-3))" 
              strokeWidth={2}
              name="Points Earned"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
