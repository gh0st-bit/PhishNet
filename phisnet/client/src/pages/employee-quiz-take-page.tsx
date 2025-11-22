import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, ChevronLeft, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showBadgeUnlockedToast, showLevelUpToast, showXpGainedToast } from "@/lib/achievement-toast";
import { CelebrationModal } from "@/components/dashboard/celebration-modal";

interface QuizQuestion {
  id: number;
  questionText: string;
  questionType: string;
  options: string[];
  points: number;
  orderIndex: number;
  correctAnswer?: string | string[];
  explanation?: string;
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
}

interface QuizData {
  quiz: Quiz;
  questions: QuizQuestion[];
  attemptCount?: number;
  canTakeQuiz?: boolean;
}

interface SubmitResult {
  attempt: any;
  score: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  results: Array<{
    questionId: number;
    userAnswer: any;
    correctAnswer?: any;
    isCorrect: boolean;
    explanation?: string;
  }>;
  gamification?: {
    xpGained: number;
    leveledUp: boolean;
    oldLevel?: number;
    newLevel?: number;
    newBadges?: Array<{
      id: number;
      name: string;
      description?: string;
      rarity?: string;
    }>;
  };
}

export default function EmployeeQuizTakePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const quizId = Number.parseInt(id || "0");

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [startedAt] = useState(new Date().toISOString());
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [celebrationModal, setCelebrationModal] = useState<{
    open: boolean;
    type: 'level-up' | 'badge' | 'milestone';
    data: any;
  }>({ open: false, type: 'level-up', data: {} });

  // Fetch quiz data
  const { data, isLoading, error } = useQuery<QuizData>({
    queryKey: [`/api/employee/quizzes/${quizId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employee/quizzes/${quizId}`);
      if (!res.ok) throw new Error("Failed to fetch quiz");
      return res.json();
    },
    enabled: !!quizId && !submitted,
  });

  // Timer logic
  useEffect(() => {
    if (data?.quiz.timeLimit && !submitted) {
      setTimeRemaining(data.quiz.timeLimit * 60); // Convert minutes to seconds
    }
  }, [data, submitted]);

  useEffect(() => {
    if (timeRemaining === null || submitted) return;

    if (timeRemaining <= 0) {
      // Auto-submit when time runs out
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, submitted]);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/employee/quizzes/${quizId}/submit`, {
        answers,
        startedAt,
      });
      if (!res.ok) throw new Error("Failed to submit quiz");
      return res.json();
    },
    onSuccess: (result: SubmitResult) => {
      setSubmitted(true);
      setSubmitResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/employee/quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/level"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/badges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/dashboard/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/dashboard/insights"] });

      // Show achievement toasts
      if (result.gamification) {
        const { xpGained, leveledUp, oldLevel, newLevel, newBadges } = result.gamification;
        
        // Show XP gained toast
        const reason = result.score === 100 ? 'perfect_score' : 'quiz_completion';
        showXpGainedToast(toast, xpGained, reason);

        // Show level up modal if leveled up (takes precedence over toasts for major events)
        if (leveledUp && oldLevel && newLevel) {
          setTimeout(() => {
            setCelebrationModal({
              open: true,
              type: 'level-up',
              data: { oldLevel, newLevel },
            });
          }, 800);
        }

        // Show first badge in modal if any were unlocked (after level-up modal)
        if (newBadges && newBadges.length > 0) {
          const delay = leveledUp ? 3000 : 1500; // Wait if level-up modal shown first
          setTimeout(() => {
            setCelebrationModal({
              open: true,
              type: 'badge',
              data: { badge: newBadges[0] },
            });
          }, delay);

          // Show remaining badges as toasts
          if (newBadges.length > 1) {
            newBadges.slice(1).forEach((badge, index) => {
              setTimeout(() => {
                showBadgeUnlockedToast(toast, badge);
              }, delay + 2000 + (index * 1500));
            });
          }
        }
      }
    },
  });

  const handleSubmit = () => {
    if (submitted) return;
    submitMutation.mutate();
  };

  const handleAnswerChange = (questionId: number, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load quiz. Please try again.</AlertDescription>
        </Alert>
        <Button onClick={() => setLocation("/employee/quizzes")} className="mt-4">
          Back to Quizzes
        </Button>
      </AppLayout>
    );
  }

  const { quiz, questions } = data;
  const shuffledQuestions = quiz.randomizeQuestions
    ? [...questions].sort(() => Math.random() - 0.5)
    : questions;

  // Show results after submission
  if (submitted && submitResult) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => setLocation("/employee/quizzes")}>
            ← Back to Quizzes
          </Button>

          <Card className="p-6 text-center">
            <div className="flex justify-center mb-4">
              {submitResult.passed ? (
                <Trophy className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {submitResult.passed ? "Quiz Passed!" : "Quiz Not Passed"}
            </h2>
            <div className="text-4xl font-bold my-4">{submitResult.score}%</div>
            <p className="text-muted-foreground mb-4">
              You answered {submitResult.correctAnswers} out of {submitResult.totalQuestions} questions correctly
            </p>
            <div className="flex gap-4 justify-center">
              {quiz.allowRetakes && (!quiz.maxAttempts || (data.attemptCount || 0) < quiz.maxAttempts) && !submitResult.passed && (
                <Button onClick={() => window.location.reload()}>
                  Retake Quiz
                </Button>
              )}
              {quiz.showCorrectAnswers && (
                <Button variant="outline" onClick={() => setShowResults(true)}>
                  Review Answers
                </Button>
              )}
              <Button variant="outline" onClick={() => setLocation("/employee/quizzes")}>
                Back to Quizzes
              </Button>
            </div>
          </Card>

          {showResults && quiz.showCorrectAnswers && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Answer Review</h3>
              {shuffledQuestions.map((question, idx) => {
                const result = submitResult.results.find((r) => r.questionId === question.id);
                if (!result) return null;

                return (
                  <Card key={question.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {result.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-1" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mt-1" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium mb-2">
                          Question {idx + 1}: {question.questionText}
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="font-medium">Your answer:</span>{" "}
                            {Array.isArray(result.userAnswer)
                              ? result.userAnswer.join(", ")
                              : result.userAnswer || "No answer"}
                          </p>
                          {!result.isCorrect && result.correctAnswer && (
                            <p className="text-green-600 dark:text-green-400">
                              <span className="font-medium">Correct answer:</span>{" "}
                              {Array.isArray(result.correctAnswer)
                                ? result.correctAnswer.join(", ")
                                : result.correctAnswer}
                            </p>
                          )}
                          {result.explanation && (
                            <p className="text-muted-foreground italic">{result.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Check if can take quiz
  if (data.canTakeQuiz === false) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have reached the maximum number of attempts for this quiz.
          </AlertDescription>
        </Alert>
        <Button onClick={() => setLocation("/employee/quizzes")} className="mt-4">
          Back to Quizzes
        </Button>
      </AppLayout>
    );
  }

  const currentQ = shuffledQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / shuffledQuestions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{quiz.title}</h1>
            <p className="text-sm text-muted-foreground">{quiz.description}</p>
          </div>
          {timeRemaining !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeRemaining < 60 ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-muted'}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Question {currentQuestion + 1} of {shuffledQuestions.length}
            </span>
            <span className="text-muted-foreground">
              {answeredCount} / {shuffledQuestions.length} answered
            </span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Question Card */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium">{currentQ.questionText}</h3>
              <span className="text-sm text-muted-foreground">{currentQ.points} pts</span>
            </div>

            {/* Question types */}
            {currentQ.questionType === "multiple_choice" && (
              <RadioGroup
                value={answers[currentQ.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
              >
                <div className="space-y-3">
                  {currentQ.options.map((option) => (
                    <div key={option} className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={option} id={`${currentQ.id}-${option}`} />
                      <Label htmlFor={`${currentQ.id}-${option}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            {currentQ.questionType === "true_false" && (
              <RadioGroup
                value={answers[currentQ.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
              >
                <div className="space-y-3">
                  {["True", "False"].map((option) => (
                    <div key={option} className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={option} id={`${currentQ.id}-${option}`} />
                      <Label htmlFor={`${currentQ.id}-${option}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            {currentQ.questionType === "multiple_select" && (
              <div className="space-y-3">
                {currentQ.options.map((option) => {
                  const selected = Array.isArray(answers[currentQ.id]) && answers[currentQ.id].includes(option);
                  return (
                    <div key={option} className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                      <Checkbox
                        id={`${currentQ.id}-${option}`}
                        checked={selected}
                        onCheckedChange={(checked) => {
                          const current = (answers[currentQ.id] || []) as string[];
                          const updated = checked
                            ? [...current, option]
                            : current.filter((o: string) => o !== option);
                          handleAnswerChange(currentQ.id, updated);
                        }}
                      />
                      <Label htmlFor={`${currentQ.id}-${option}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}

            {currentQ.questionType === "fill_blank" && (
              <Input
                placeholder="Type your answer here..."
                value={answers[currentQ.id] || ""}
                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
              />
            )}
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            {answeredCount < shuffledQuestions.length &&
              `${shuffledQuestions.length - answeredCount} question${shuffledQuestions.length - answeredCount !== 1 ? 's' : ''} remaining`}
          </span>

          {currentQuestion < shuffledQuestions.length - 1 ? (
            <Button onClick={() => setCurrentQuestion((prev) => prev + 1)}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || answeredCount < shuffledQuestions.length}
            >
              {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Quiz
            </Button>
          )}
        </div>

        {/* Warning for unanswered */}
        {answeredCount < shuffledQuestions.length && currentQuestion === shuffledQuestions.length - 1 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please answer all questions before submitting. You have {shuffledQuestions.length - answeredCount} unanswered question(s).
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Celebration Modal */}
      <CelebrationModal
        open={celebrationModal.open}
        onClose={() => setCelebrationModal({ ...celebrationModal, open: false })}
        type={celebrationModal.type}
        data={celebrationModal.data}
      />
    </AppLayout>
  );
}
