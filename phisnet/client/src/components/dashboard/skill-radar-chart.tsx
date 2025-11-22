import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface SkillData {
  category: string;
  completionRate: number;
  totalModules: number;
  completedModules: number;
}

interface SkillRadarChartProps {
  data: SkillData[];
  title?: string;
  description?: string;
}

export function SkillRadarChart({ 
  data = [], 
  title = "Skill Mastery",
  description = "Your expertise across different categories"
}: SkillRadarChartProps) {
  // Transform data for radar chart
  const radarData = data.map(skill => ({
    category: skill.category,
    mastery: skill.completionRate
  }));

  return (
    <Card className="p-3 sm:p-4 lg:p-5">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
          <Target className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="truncate">{title}</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid className="stroke-muted" />
            <PolarAngleAxis 
              dataKey="category" 
              className="text-[10px] sm:text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]}
              className="text-[10px] sm:text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <Radar 
              name="Mastery %" 
              dataKey="mastery" 
              stroke="hsl(var(--primary))" 
              fill="hsl(var(--primary))" 
              fillOpacity={0.6}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
          </RadarChart>
        </ResponsiveContainer>
        </div>

        {/* Skill Breakdown List */}
        <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
          {data.slice(0, 8).map((skill) => (
            <div key={skill.category} className="flex items-center justify-between text-[10px] sm:text-xs">
              <span className="text-muted-foreground truncate max-w-[120px] sm:max-w-[160px]">{skill.category}</span>
              <span className="font-medium whitespace-nowrap">
                {skill.completedModules}/{skill.totalModules} ({skill.completionRate}%)
              </span>
            </div>
          ))}
          {data.length === 0 && (
            <div className="text-[10px] sm:text-xs text-muted-foreground">No skill data yet</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
