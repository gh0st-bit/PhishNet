import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface QuizTrend {
  category: string;
  averageScore: number;
  attemptsCount: number;
}

interface QuizPerformanceLineProps {
  data?: QuizTrend[];
  title?: string;
  description?: string;
}

export function QuizPerformanceLine({ 
  data = [], 
  title = "Quiz Performance by Category",
  description = "Your recent quiz results across topics"
}: QuizPerformanceLineProps) {
  // Defensive: ensure array and sort by category for consistent ordering
  const sortedData = [...data].sort((a, b) => a.category.localeCompare(b.category));

  const hasData = sortedData.length > 0;

  return (
    <Card className="p-3 sm:p-4 lg:p-5">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="truncate">{title}</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full h-56 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sortedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="category" 
                className="text-[10px] sm:text-xs"
                tick={{ fill: 'currentColor' }}
                angle={-45}
                textAnchor="end"
                height={hasData ? 80 : 20}
                interval={0}
              />
              <YAxis 
                domain={[0, 100]}
                className="text-[10px] sm:text-xs"
                tick={{ fill: 'currentColor' }}
                label={{ value: 'Score %', angle: -90, position: 'insideLeft', className: 'text-[10px] sm:text-xs' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number, name: string, props: any) => {
                  if (name === 'averageScore') {
                    return [`${value}% (${props.payload.attemptsCount} attempts)`, 'Avg Score'];
                  }
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line 
                type="monotone" 
                dataKey="averageScore" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                name="Average Score"
                dot={{ r: 3 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Summary */}
        <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3">
          {hasData && sortedData.slice(0, 4).map((category) => {
            const performance = category.averageScore >= 80 ? 'strong' : 
                               category.averageScore >= 60 ? 'good' : 'needs-improvement';
            const color = performance === 'strong' ? 'text-green-600' : 
                         performance === 'good' ? 'text-blue-600' : 'text-orange-600';
            return (
              <div key={category.category} className="text-[10px] sm:text-xs">
                <div className="font-medium truncate max-w-[90px] sm:max-w-[140px]">{category.category}</div>
                <div className={`${color} font-semibold`}>{category.averageScore}% avg</div>
              </div>
            );
          })}
          {!hasData && (
            <div className="col-span-2 text-[10px] sm:text-xs text-muted-foreground">
              No quiz performance data yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
