import { z } from "zod";

export const quizFormSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  passingScore: z.number().int().min(0).max(100),
  timeLimit: z.number().int().min(0).max(600).optional(),
  allowRetakes: z.boolean(),
  maxAttempts: z.number().int().min(0).max(50).optional(),
  showCorrectAnswers: z.boolean(),
  randomizeQuestions: z.boolean().optional()
});

export const quizQuestionFormSchema = z.object({
  questionText: z.string().min(1, "Question text required"),
  questionType: z.enum(["multiple_choice","true_false","multiple_select","fill_blank"]),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, "Correct answer required"),
  points: z.number().int().min(1),
  explanation: z.string().optional(),
  orderIndex: z.number().int().min(0)
});

export const articleFormSchema = z.object({
  title: z.string().min(1, "Title required"),
  content: z.string().min(1, "Content required"),
  excerpt: z.string().optional(),
  category: z.string().min(1, "Category required"),
  tags: z.array(z.string()).optional(),
  readTimeMinutes: z.number().int().min(0).max(120).optional()
});

export const flashcardDeckFormSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category required")
});

export const flashcardFormSchema = z.object({
  frontContent: z.string().min(1, "Front required"),
  backContent: z.string().min(1, "Back required"),
  orderIndex: z.number().int().min(0)
});

export const badgeFormSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category required"),
  pointsAwarded: z.number().int().min(0).optional(),
  rarity: z.enum(["common","rare","epic","legendary"]).optional(),
  criteria: z.any()
});

export type QuizFormValues = z.infer<typeof quizFormSchema>;
export type QuizQuestionFormValues = z.infer<typeof quizQuestionFormSchema>;
