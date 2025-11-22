import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, BookOpen, FileText } from 'lucide-react';
import { useLocation } from 'wouter';

interface RecommendedModule {
  id: number;
  title: string;
  category: string;
  difficulty: string;
}

interface RecommendedArticle {
  id: number;
  title: string;
  category: string;
  estimatedReadTime: number | null;
}

interface RecommendedContentProps {
  modules: RecommendedModule[];
  articles: RecommendedArticle[];
}

export function RecommendedContent({ modules, articles }: RecommendedContentProps) {
  const [, setLocation] = useLocation();

  const hasRecommendations = modules.length > 0 || articles.length > 0;

  if (!hasRecommendations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recommended for You
          </CardTitle>
          <CardDescription>Personalized learning suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            Great job! You're performing well across all areas. Keep up the excellent work!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Recommended for You
        </CardTitle>
        <CardDescription>
          {modules.length > 0 && `${modules.length} module${modules.length !== 1 ? 's' : ''}`}
          {modules.length > 0 && articles.length > 0 && ' and '}
          {articles.length > 0 && `${articles.length} article${articles.length !== 1 ? 's' : ''}`}
          {' '}to strengthen your skills
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Recommended Modules */}
          {modules.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <BookOpen className="h-4 w-4" />
                <span>Training Modules</span>
              </div>
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => setLocation(`/employee/training/${module.id}`)}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="font-medium text-sm truncate">{module.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {module.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {module.difficulty}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">
                    Start
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Recommended Articles */}
          {articles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <FileText className="h-4 w-4" />
                <span>Articles</span>
              </div>
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => setLocation(`/employee/articles/${article.id}`)}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="font-medium text-sm truncate">{article.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {article.category}
                      </Badge>
                      {article.estimatedReadTime && (
                        <span className="text-xs text-muted-foreground">
                          {article.estimatedReadTime} min read
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">
                    Read
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Insight */}
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5" />
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <span className="font-medium">Smart recommendation:</span>{' '}
                These resources focus on areas where you can improve based on your quiz performance.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
