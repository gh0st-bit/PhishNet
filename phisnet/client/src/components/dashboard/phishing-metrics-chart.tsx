import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "next-themes";

interface DataPoint {
  date: string;
  rate: number;
}

interface PhishingMetricsChartProps {
  data?: DataPoint[];
}

export default function PhishingMetricsChart({ data }: PhishingMetricsChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Use theme colors that match your tailwind theme
  // System Color Scheme can be handled with additional logic if needed
  const colors = {
    text: isDark ? "#C9D1D9" : "#24292F",
    muted: isDark ? "#8B949E" : "#6E7781",
    grid: isDark ? "#30363D" : "#EAEEF2",
    line: isDark ? "#58A6FF" : "#0969DA",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Phishing Success Rate</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 5,
                left: 5,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis 
                dataKey="date" 
                stroke={colors.muted} 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke={colors.muted} 
                fontSize={12}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: isDark ? "#161B22" : "#FFF",
                  borderColor: colors.grid,
                  color: colors.text
                }}
                labelStyle={{ color: colors.text }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke={colors.line}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No metrics data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
