import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Calendar, Tag } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { format } from "date-fns";

interface Article {
  id: number;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string[];
  thumbnailUrl: string | null;
  readTimeMinutes: number | null;
  publishedAt: string;
  author: number | null;
  published: boolean;
}

export default function EmployeeArticleDetailPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/employee/articles/:id");
  const articleId = params?.id;

  const { data: article, isLoading } = useQuery<Article>({
    queryKey: [`/api/employee/articles/${articleId}`],
    enabled: !!articleId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Article not found</p>
            <Button onClick={() => navigate("/employee/articles")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Articles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/employee/articles")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Articles
      </Button>

      <Card>
        {article.thumbnailUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
            <img 
              src={article.thumbnailUrl} 
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <CardHeader>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <Badge variant="secondary">{article.category}</Badge>
            {article.readTimeMinutes && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{article.readTimeMinutes} min read</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(article.publishedAt), "MMM d, yyyy")}</span>
            </div>
          </div>

          <CardTitle className="text-3xl">{article.title}</CardTitle>
          
          {article.excerpt && (
            <CardDescription className="text-lg mt-2">
              {article.excerpt}
            </CardDescription>
          )}

          {article.tags && article.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-4">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {article.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div 
            className="prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
