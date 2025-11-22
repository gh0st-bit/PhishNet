import { useState } from "react";
import { quizFormSchema, quizQuestionFormSchema } from "../validation/adminSchemas";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Edit, Trash2, HelpCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuizQuestion {
  id: number;
  questionText: string;
  questionType: string;
  options: string[];
  correctAnswer: string | string[];
  points: number;
  explanation: string | null;
  orderIndex: number;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  passingScore: number;
  timeLimit: number | null;
  allowRetakes: boolean;
  maxAttempts: number | null;
  showCorrectAnswers: boolean;
  randomizeQuestions?: boolean;
  questions?: QuizQuestion[];
}

interface PaginatedQuizzesResponse {
  quizzes: Quiz[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminQuizPage() {
  const queryClient = useQueryClient();
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  
  const [quizFormData, setQuizFormData] = useState({
    title: "",
    description: "",
    passingScore: 80,
    timeLimit: 0,
    allowRetakes: true,
    maxAttempts: 3,
    showCorrectAnswers: true,
    randomizeQuestions: false,
  });
  const [quizFormErrors, setQuizFormErrors] = useState<string[]>([]);

  const [questionFormData, setQuestionFormData] = useState({
    questionText: "",
    questionType: "multiple_choice",
    options: ["", "", "", ""],
    correctAnswer: "",
    points: 10,
    explanation: "",
    orderIndex: 0,
  });
  const [questionFormErrors, setQuestionFormErrors] = useState<string[]>([]);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 12; // UI page size

  // Fetch paginated quizzes
  const { data: quizzesResp, isLoading, error } = useQuery<PaginatedQuizzesResponse>({
    queryKey: ["/api/admin/quizzes", page, pageSize],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/quizzes?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("Failed to fetch quizzes");
      return res.json();
    },
  });

  // Fetch quiz details with questions
  const { data: quizDetail } = useQuery<Quiz>({
    queryKey: ["/api/admin/quizzes", selectedQuiz?.id],
    enabled: !!selectedQuiz,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/quizzes/${selectedQuiz!.id}`);
      if (!res.ok) throw new Error("Failed to fetch quiz details");
      return res.json();
    },
  });

  // Quiz mutations
  const createQuizMutation = useMutation({
    mutationFn: async (data: typeof quizFormData) => {
      const res = await apiRequest("POST", "/api/admin/quizzes", {
        title: data.title,
        description: data.description,
        passingScore: data.passingScore,
        timeLimit: data.timeLimit || null,
        allowRetakes: data.allowRetakes,
        maxAttempts: data.maxAttempts || null,
        showCorrectAnswers: data.showCorrectAnswers,
      });
      if (!res.ok) throw new Error("Failed to create quiz");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quizzes", page, pageSize] });
      setIsQuizDialogOpen(false);
      resetQuizForm();
    },
  });

  const updateQuizMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof quizFormData }) => {
      const res = await apiRequest("PUT", `/api/admin/quizzes/${id}`, {
        title: data.title,
        description: data.description,
        passingScore: data.passingScore,
        timeLimit: data.timeLimit || null,
        allowRetakes: data.allowRetakes,
        maxAttempts: data.maxAttempts || null,
        showCorrectAnswers: data.showCorrectAnswers,
      });
      if (!res.ok) throw new Error("Failed to update quiz");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quizzes", page, pageSize] });
      setIsQuizDialogOpen(false);
      setEditingQuiz(null);
      resetQuizForm();
    },
  });

  const deleteQuizMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/quizzes/${id}`);
      if (!res.ok) throw new Error("Failed to delete quiz");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quizzes", page, pageSize] });
      setSelectedQuiz(null);
    },
  });

  // Question mutations
  const createQuestionMutation = useMutation({
    mutationFn: async (data: typeof questionFormData) => {
      const res = await apiRequest("POST", `/api/admin/quizzes/${selectedQuiz!.id}/questions`, {
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.questionType === "true_false" 
          ? ["True", "False"] 
          : data.options.filter(Boolean),
        correctAnswer: data.questionType === "multiple_select"
          ? data.correctAnswer.split(",").map(a => a.trim())
          : data.correctAnswer,
        explanation: data.explanation || undefined,
        points: data.points,
        orderIndex: data.orderIndex,
      });
      if (!res.ok) throw new Error("Failed to create question");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quizzes", selectedQuiz?.id] });
      setIsQuestionDialogOpen(false);
      resetQuestionForm();
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof questionFormData }) => {
      const res = await apiRequest("PUT", `/api/admin/quiz-questions/${id}`, {
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.questionType === "true_false"
          ? ["True", "False"]
          : data.options.filter(Boolean),
        correctAnswer: data.questionType === "multiple_select"
          ? data.correctAnswer.split(",").map(a => a.trim())
          : data.correctAnswer,
        explanation: data.explanation || undefined,
        points: data.points,
        orderIndex: data.orderIndex,
      });
      if (!res.ok) throw new Error("Failed to update question");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quizzes", selectedQuiz?.id] });
      setIsQuestionDialogOpen(false);
      setEditingQuestion(null);
      resetQuestionForm();
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/quiz-questions/${id}`);
      if (!res.ok) throw new Error("Failed to delete question");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quizzes", selectedQuiz?.id] });
    },
  });

  const resetQuizForm = () => {
    setQuizFormData({
      title: "",
      description: "",
      passingScore: 80,
      timeLimit: 0,
      allowRetakes: true,
      maxAttempts: 3,
      showCorrectAnswers: true,
      randomizeQuestions: false,
    });
  };

  const resetQuestionForm = () => {
    setQuestionFormData({
      questionText: "",
      questionType: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 10,
      explanation: "",
      orderIndex: quizDetail?.questions?.length || 0,
    });
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setQuizFormData({
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      timeLimit: quiz.timeLimit || 0,
      allowRetakes: quiz.allowRetakes,
      maxAttempts: quiz.maxAttempts || 0,
      showCorrectAnswers: quiz.showCorrectAnswers,
      randomizeQuestions: quiz.randomizeQuestions ?? false,
    });
    setIsQuizDialogOpen(true);
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    setEditingQuestion(question);
    setQuestionFormData({
      questionText: question.questionText,
      questionType: question.questionType,
      options: Array.isArray(question.options) ? [...question.options, "", "", "", ""].slice(0, 4) : ["", "", "", ""],
      correctAnswer: Array.isArray(question.correctAnswer)
        ? question.correctAnswer.join(", ")
        : String(question.correctAnswer),
      points: question.points,
      explanation: question.explanation || "",
      orderIndex: question.orderIndex,
    });
    setIsQuestionDialogOpen(true);
  };

  const handleDeleteQuiz = (id: number, title: string) => {
    if (confirm(`Delete "${title}"? This will remove all questions and student responses.`)) {
      deleteQuizMutation.mutate(id);
    }
  };

  const handleDeleteQuestion = (id: number) => {
    if (confirm("Delete this question? Student responses will also be removed.")) {
      deleteQuestionMutation.mutate(id);
    }
  };

  if (selectedQuiz && quizDetail) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setSelectedQuiz(null)} className="mb-2">
              ← Back to Quizzes
            </Button>
            <h1 className="text-2xl font-bold">{quizDetail.title}</h1>
            <p className="text-sm text-muted-foreground">{quizDetail.description}</p>
          </div>
          <Dialog open={isQuestionDialogOpen} onOpenChange={(open) => {
            setIsQuestionDialogOpen(open);
            if (!open) {
              setEditingQuestion(null);
              resetQuestionForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuestion ? "Edit" : "Add"} Question</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                setQuestionFormErrors([]);
                const parsed = quizQuestionFormSchema.safeParse({
                  ...questionFormData,
                  options: (questionFormData.questionType === "true_false" ? ["True","False"] : questionFormData.options).filter(Boolean)
                });
                if (!parsed.success) {
                  setQuestionFormErrors(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
                  return;
                }
                if (editingQuestion) {
                  updateQuestionMutation.mutate({ id: editingQuestion.id, data: questionFormData });
                } else {
                  createQuestionMutation.mutate(questionFormData);
                }
              }} className="space-y-4">
                {questionFormErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription className="space-y-1">
                      {questionFormErrors.map(err => <div key={err}>{err}</div>)}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label>Question Text *</Label>
                  <Textarea
                    value={questionFormData.questionText}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, questionText: e.target.value })}
                    placeholder="Enter your question..."
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Question Type *</Label>
                    <Select
                      value={questionFormData.questionType}
                      onValueChange={(value) => setQuestionFormData({
                        ...questionFormData,
                        questionType: value,
                        options: value === "true_false" ? ["True", "False"] : ["", "", "", ""],
                        correctAnswer: "",
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="true_false">True/False</SelectItem>
                        <SelectItem value="multiple_select">Multiple Select</SelectItem>
                        <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Points *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={questionFormData.points}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, points: Number.parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                {(questionFormData.questionType === "multiple_choice" || questionFormData.questionType === "multiple_select") && (
                  <div className="space-y-2">
                    <Label>Options *</Label>
                    {questionFormData.options.map((option, idx) => (
                      <Input
                        key={`option-${idx}-${option}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...questionFormData.options];
                          newOptions[idx] = e.target.value;
                          setQuestionFormData({ ...questionFormData, options: newOptions });
                        }}
                        placeholder={`Option ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Correct Answer *</Label>
                  {questionFormData.questionType === "multiple_choice" && (
                    <Select
                      value={questionFormData.correctAnswer}
                      onValueChange={(value) => setQuestionFormData({ ...questionFormData, correctAnswer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct option" />
                      </SelectTrigger>
                      <SelectContent>
                        {questionFormData.options.filter(Boolean).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {questionFormData.questionType === "true_false" && (
                    <Select
                      value={questionFormData.correctAnswer}
                      onValueChange={(value) => setQuestionFormData({ ...questionFormData, correctAnswer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="True">True</SelectItem>
                        <SelectItem value="False">False</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {questionFormData.questionType === "multiple_select" && (
                    <Input
                      value={questionFormData.correctAnswer}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, correctAnswer: e.target.value })}
                      placeholder="Comma-separated correct options"
                    />
                  )}
                  {questionFormData.questionType === "fill_blank" && (
                    <Input
                      value={questionFormData.correctAnswer}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, correctAnswer: e.target.value })}
                      placeholder="Expected answer"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Explanation (shown after answering)</Label>
                  <Textarea
                    value={questionFormData.explanation}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
                    placeholder="Explain why this is the correct answer..."
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}>
                    {(createQuestionMutation.isPending || updateQuestionMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingQuestion ? "Update" : "Add"} Question
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {(quizDetail.questions || []).length === 0 ? (
            <Card className="p-8 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No questions yet. Add your first question to get started.</p>
            </Card>
          ) : (
            (quizDetail.questions || []).map((question, idx) => (
              <Card key={question.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Q{idx + 1}</Badge>
                      <Badge variant="secondary">{question.questionType.replace("_", " ")}</Badge>
                      <Badge>{question.points} pts</Badge>
                    </div>
                    <p className="font-medium">{question.questionText}</p>
                    {question.options && question.options.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-muted-foreground pl-4">
                        {question.options.map((opt) => (
                          <li key={opt}>{opt}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ Correct: {Array.isArray(question.correctAnswer) 
                        ? question.correctAnswer.join(", ") 
                        : question.correctAnswer}
                    </p>
                    {question.explanation && (
                      <p className="text-sm text-muted-foreground italic">{question.explanation}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditQuestion(question)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => handleDeleteQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quiz Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage security awareness quizzes</p>
        </div>
        <Dialog open={isQuizDialogOpen} onOpenChange={(open) => {
          setIsQuizDialogOpen(open);
          if (!open) {
            setEditingQuiz(null);
            resetQuizForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Quiz
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingQuiz ? "Edit" : "Create"} Quiz</DialogTitle>
              <DialogDescription>
                {editingQuiz ? "Update quiz settings" : "Set up a new security awareness quiz"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              // Clear previous errors
              setQuizFormErrors([]);
              const parsed = quizFormSchema.safeParse({
                ...quizFormData,
                maxAttempts: quizFormData.maxAttempts === 0 ? undefined : quizFormData.maxAttempts,
                timeLimit: quizFormData.timeLimit === 0 ? undefined : quizFormData.timeLimit
              });
              if (!parsed.success) {
                setQuizFormErrors(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
                return;
              }
              if (editingQuiz) {
                updateQuizMutation.mutate({ id: editingQuiz.id, data: quizFormData });
              } else {
                createQuizMutation.mutate(quizFormData);
              }
            }} className="space-y-4">
              {quizFormErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription className="space-y-1">
                    {quizFormErrors.map(err => <div key={err}>{err}</div>)}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={quizFormData.title}
                  onChange={(e) => setQuizFormData({ ...quizFormData, title: e.target.value })}
                  placeholder="e.g., Phishing Awareness Quiz"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={quizFormData.description}
                  onChange={(e) => setQuizFormData({ ...quizFormData, description: e.target.value })}
                  placeholder="What this quiz covers..."
                  rows={2}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Passing Score % *</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={quizFormData.passingScore}
                    onChange={(e) => setQuizFormData({ ...quizFormData, passingScore: Number.parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Time Limit (min)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quizFormData.timeLimit}
                    onChange={(e) => setQuizFormData({ ...quizFormData, timeLimit: Number.parseInt(e.target.value) })}
                    placeholder="0 = unlimited"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quizFormData.maxAttempts}
                    onChange={(e) => setQuizFormData({ ...quizFormData, maxAttempts: Number.parseInt(e.target.value) })}
                    placeholder="0 = unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="allowRetakes"
                    checked={quizFormData.allowRetakes}
                    onChange={(e) => setQuizFormData({ ...quizFormData, allowRetakes: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="allowRetakes" className="font-normal cursor-pointer">
                    Allow retakes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showCorrectAnswers"
                    checked={quizFormData.showCorrectAnswers}
                    onChange={(e) => setQuizFormData({ ...quizFormData, showCorrectAnswers: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="showCorrectAnswers" className="font-normal cursor-pointer">
                    Show correct answers after attempt
                  </Label>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="randomizeQuestions"
                  checked={quizFormData.randomizeQuestions}
                  onChange={(e) => setQuizFormData({ ...quizFormData, randomizeQuestions: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="randomizeQuestions" className="font-normal cursor-pointer">
                  Randomize question order (future)
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsQuizDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createQuizMutation.isPending || updateQuizMutation.isPending}>
                  {(createQuizMutation.isPending || updateQuizMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingQuiz ? "Update" : "Create"} Quiz
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load quizzes. Please try again.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(quizzesResp?.quizzes || []).map((quiz) => (
              <Card key={quiz.id} className="p-5 flex flex-col gap-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedQuiz(quiz)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg line-clamp-2">{quiz.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{quiz.description}</p>
                  </div>
                  <Badge variant="outline">{quiz.passingScore}% pass</Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{quiz.allowRetakes ? 'Retakes Allowed' : 'Single Attempt'}</Badge>
                  {quiz.maxAttempts && quiz.maxAttempts > 0 && <Badge variant="outline">Max {quiz.maxAttempts}</Badge>}
                  {quiz.timeLimit && quiz.timeLimit > 0 && <Badge variant="outline">{quiz.timeLimit} min</Badge>}
                  <Badge variant="outline">{quiz.showCorrectAnswers ? 'Answers Shown' : 'Hidden Answers'}</Badge>
                </div>

                <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }} role="toolbar" tabIndex={0}>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditQuiz(quiz)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}

            {!(quizzesResp?.quizzes || []).length && (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">No quizzes yet. Create your first one!</p>
              </div>
            )}
          </div>

          {/* Pagination controls */}
          {quizzesResp && quizzesResp.total > quizzesResp.pageSize && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}
                -{Math.min(page * pageSize, quizzesResp.total)} of {quizzesResp.total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs font-medium">
                  Page {page} / {quizzesResp.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= quizzesResp.totalPages}
                  onClick={() => setPage((p) => Math.min(quizzesResp.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
