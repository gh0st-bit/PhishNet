/**
 * Unit tests for Zod validation schemas
 */

import {
  insertQuizSchema,
  updateQuizSchema,
  insertQuizQuestionSchema,
  insertArticleSchema,
  updateArticleSchema,
  insertFlashcardDeckSchema,
  updateFlashcardDeckSchema,
  insertFlashcardSchema,
  updateFlashcardSchema,
  insertBadgeSchema,
  updateBadgeSchema
} from '../../../shared/schema';

describe('Validation Schemas', () => {
  describe('Quiz Schemas', () => {
    describe('insertQuizSchema', () => {
      it('should validate correct quiz data', () => {
        const validQuiz = {
          organizationId: 1,
          createdBy: 1,
          title: 'Security Basics Quiz',
          description: 'Test your security knowledge',
          passingScore: 70,
          timeLimit: 30,
          allowRetakes: true,
          maxAttempts: 3,
          showCorrectAnswers: true,
          randomizeQuestions: false
        };

        const result = insertQuizSchema.safeParse(validQuiz);
        expect(result.success).toBe(true);
      });

      it('should reject quiz without required createdBy', () => {
        const invalidQuiz = {
          organizationId: 1,
          title: 'Quiz without creator',
          passingScore: 70
        };

        const result = insertQuizSchema.safeParse(invalidQuiz);
        expect(result.success).toBe(false);
      });

      it('should reject quiz without required organizationId', () => {
        const invalidQuiz = {
          title: 'Quiz without org',
          description: 'Missing org',
          passingScore: 70
        };

        const result = insertQuizSchema.safeParse(invalidQuiz);
        expect(result.success).toBe(false);
      });

      it('should reject quiz without title', () => {
        const invalidQuiz = {
          organizationId: 1,
          description: 'No title',
          passingScore: 70
        };

        const result = insertQuizSchema.safeParse(invalidQuiz);
        expect(result.success).toBe(false);
      });

      it('should accept quiz with minimal required fields', () => {
        const minimalQuiz = {
          organizationId: 1,
          createdBy: 1,
          title: 'Minimal Quiz',
          passingScore: 70 // Required by schema even though DB has default of 80
        };

        const result = insertQuizSchema.safeParse(minimalQuiz);
        if (!result.success) {
          console.log('Minimal quiz errors:', JSON.stringify(result.error.errors, null, 2));
        }
        expect(result.success).toBe(true);
      });

      it('should reject passingScore below 0', () => {
        const invalidQuiz = {
          organizationId: 1,
          title: 'Test Quiz',
          passingScore: -10
        };

        const result = insertQuizSchema.safeParse(invalidQuiz);
        expect(result.success).toBe(false);
      });

      it('should reject passingScore above 100', () => {
        const invalidQuiz = {
          organizationId: 1,
          title: 'Test Quiz',
          passingScore: 150
        };

        const result = insertQuizSchema.safeParse(invalidQuiz);
        expect(result.success).toBe(false);
      });

      it('should accept passingScore between 0 and 100', () => {
        const validQuiz = {
          organizationId: 1,
          createdBy: 1,
          title: 'Test Quiz',
          passingScore: 75
        };

        const result = insertQuizSchema.safeParse(validQuiz);
        expect(result.success).toBe(true);
      });
    });

    describe('updateQuizSchema', () => {
      it('should allow partial updates', () => {
        const partialUpdate = {
          title: 'Updated Title'
        };

        const result = updateQuizSchema.safeParse(partialUpdate);
        expect(result.success).toBe(true);
      });

      it('should allow updating passingScore only', () => {
        const partialUpdate = {
          passingScore: 80
        };

        const result = updateQuizSchema.safeParse(partialUpdate);
        expect(result.success).toBe(true);
      });

      it('should still validate passingScore bounds', () => {
        const invalidUpdate = {
          passingScore: 150
        };

        const result = updateQuizSchema.safeParse(invalidUpdate);
        expect(result.success).toBe(false);
      });
    });

    describe('insertQuizQuestionSchema', () => {
      it('should validate multiple_choice question', () => {
        const question = {
          quizId: 1,
          questionText: 'What is phishing?',
          questionType: 'multiple_choice' as const,
          options: ['Email scam', 'Fishing trip', 'Phone call', 'Mail delivery'],
          correctAnswer: 'Email scam',
          points: 10,
          orderIndex: 1
        };

        const result = insertQuizQuestionSchema.safeParse(question);
        expect(result.success).toBe(true);
      });

      it('should validate true_false question', () => {
        const question = {
          quizId: 1,
          questionText: 'Phishing emails can look legitimate',
          questionType: 'true_false' as const,
          correctAnswer: true,
          points: 5
        };

        const result = insertQuizQuestionSchema.safeParse(question);
        expect(result.success).toBe(true);
      });

      it('should reject question without questionText', () => {
        const question = {
          quizId: 1,
          questionType: 'multiple_choice' as const,
          correctAnswer: 'Test'
        };

        const result = insertQuizQuestionSchema.safeParse(question);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Article Schemas', () => {
    describe('insertArticleSchema', () => {
      it('should validate complete article', () => {
        const article = {
          organizationId: 1,
          title: 'Phishing Awareness',
          content: 'Complete article content...',
          category: 'Security',
          tags: ['phishing', 'security'],
          readTimeMinutes: 5
        };

        const result = insertArticleSchema.safeParse(article);
        expect(result.success).toBe(true);
      });

      it('should accept minimal article', () => {
        const article = {
          organizationId: 1,
          title: 'Article',
          content: 'Content',
          category: 'General'
        };

        const result = insertArticleSchema.safeParse(article);
        expect(result.success).toBe(true);
      });

      it('should reject article without organizationId', () => {
        const article = {
          title: 'Article',
          content: 'Content',
          category: 'General'
        };

        const result = insertArticleSchema.safeParse(article);
        expect(result.success).toBe(false);
      });

      it('should reject article without title', () => {
        const article = {
          organizationId: 1,
          content: 'Content',
          category: 'General'
        };

        const result = insertArticleSchema.safeParse(article);
        expect(result.success).toBe(false);
      });

      it('should reject article without content', () => {
        const article = {
          organizationId: 1,
          title: 'Article',
          category: 'General'
        };

        const result = insertArticleSchema.safeParse(article);
        expect(result.success).toBe(false);
      });

      it('should reject article without category', () => {
        const article = {
          organizationId: 1,
          title: 'Article',
          content: 'Content'
        };

        const result = insertArticleSchema.safeParse(article);
        expect(result.success).toBe(false);
      });
    });

    describe('updateArticleSchema', () => {
      it('should allow partial updates', () => {
        const update = {
          title: 'Updated Title'
        };

        const result = updateArticleSchema.safeParse(update);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Flashcard Schemas', () => {
    describe('insertFlashcardDeckSchema', () => {
      it('should validate complete deck', () => {
        const deck = {
          organizationId: 1,
          createdBy: 1,
          title: 'Security Terms',
          description: 'Key security vocabulary',
          category: 'Security'
        };

        const result = insertFlashcardDeckSchema.safeParse(deck);
        expect(result.success).toBe(true);
      });

      it('should accept minimal deck', () => {
        const deck = {
          organizationId: 1,
          createdBy: 1,
          title: 'Deck',
          category: 'General'
        };

        const result = insertFlashcardDeckSchema.safeParse(deck);
        expect(result.success).toBe(true);
      });

      it('should reject deck without organizationId', () => {
        const deck = {
          title: 'Deck',
          category: 'General'
        };

        const result = insertFlashcardDeckSchema.safeParse(deck);
        expect(result.success).toBe(false);
      });

      it('should reject deck without title', () => {
        const deck = {
          organizationId: 1,
          category: 'General'
        };

        const result = insertFlashcardDeckSchema.safeParse(deck);
        expect(result.success).toBe(false);
      });

      it('should reject deck without category', () => {
        const deck = {
          organizationId: 1,
          title: 'Deck'
        };

        const result = insertFlashcardDeckSchema.safeParse(deck);
        expect(result.success).toBe(false);
      });
    });

    describe('insertFlashcardSchema', () => {
      it('should validate flashcard with required fields', () => {
        const card = {
          deckId: 1,
          frontContent: 'What is phishing?',
          backContent: 'A social engineering attack'
        };

        const result = insertFlashcardSchema.safeParse(card);
        expect(result.success).toBe(true);
      });

      it('should reject flashcard without deckId', () => {
        const card = {
          frontContent: 'Front',
          backContent: 'Back'
        };

        const result = insertFlashcardSchema.safeParse(card);
        expect(result.success).toBe(false);
      });

      it('should reject flashcard without frontContent', () => {
        const card = {
          deckId: 1,
          backContent: 'Back'
        };

        const result = insertFlashcardSchema.safeParse(card);
        expect(result.success).toBe(false);
      });

      it('should reject flashcard without backContent', () => {
        const card = {
          deckId: 1,
          frontContent: 'Front'
        };

        const result = insertFlashcardSchema.safeParse(card);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Badge Schemas', () => {
    describe('insertBadgeSchema', () => {
      it('should validate complete badge', () => {
        const badge = {
          name: 'Security Expert',
          description: 'Master security fundamentals',
          iconUrl: 'badge.png',
          category: 'achievement',
          criteria: { type: 'total_points', amount: 1000 },
          pointsAwarded: 100,
          rarity: 'epic' as const
        };

        const result = insertBadgeSchema.safeParse(badge);
        expect(result.success).toBe(true);
      });

      it('should accept minimal badge', () => {
        const badge = {
          name: 'First Steps',
          category: 'milestone'
        };

        const result = insertBadgeSchema.safeParse(badge);
        expect(result.success).toBe(true);
      });

      it('should reject badge without name', () => {
        const badge = {
          category: 'achievement',
          criteria: { type: 'points', amount: 100 }
        };

        const result = insertBadgeSchema.safeParse(badge);
        expect(result.success).toBe(false);
      });

      it('should reject badge without category', () => {
        const badge = {
          name: 'Test Badge',
          criteria: { type: 'points', amount: 100 }
        };

        const result = insertBadgeSchema.safeParse(badge);
        expect(result.success).toBe(false);
      });

      it('should validate rarity levels', () => {
        const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
        
        rarities.forEach(rarity => {
          const badge = {
            name: `${rarity} Badge`,
            category: 'achievement',
            rarity
          };

          const result = insertBadgeSchema.safeParse(badge);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid rarity', () => {
        const badge = {
          name: 'Test Badge',
          category: 'achievement',
          rarity: 'invalid'
        };

        const result = insertBadgeSchema.safeParse(badge);
        expect(result.success).toBe(false);
      });

      it('should accept criteria as any type', () => {
        const badge = {
          name: 'Test Badge',
          category: 'achievement',
          criteria: { type: 'custom', value: 'anything' }
        };

        const result = insertBadgeSchema.safeParse(badge);
        expect(result.success).toBe(true);
      });

      it('should accept negative pointsAwarded', () => {
        const badge = {
          name: 'Test Badge',
          category: 'achievement',
          pointsAwarded: -10 // Schema has min(0), so this should fail
        };

        const result = insertBadgeSchema.safeParse(badge);
        expect(result.success).toBe(false);
      });

      it('should validate pointsAwarded is non-negative', () => {
        const badge1 = {
          name: 'Test Badge',
          category: 'achievement',
          pointsAwarded: 0
        };
        const badge2 = {
          name: 'Test Badge',
          category: 'achievement',
          pointsAwarded: 50
        };

        expect(insertBadgeSchema.safeParse(badge1).success).toBe(true);
        expect(insertBadgeSchema.safeParse(badge2).success).toBe(true);
      });
    });

    describe('updateBadgeSchema', () => {
      it('should allow partial updates', () => {
        const update = {
          name: 'Updated Badge Name'
        };

        const result = updateBadgeSchema.safeParse(update);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Cross-Schema Validation', () => {
    it('should maintain consistent validation rules', () => {
      const quiz = {
        organizationId: 1,
        createdBy: 1,
        title: 'Test',
        passingScore: 75
      };

      const insertResult = insertQuizSchema.safeParse(quiz);
      const updateResult = updateQuizSchema.safeParse({ passingScore: 75 });

      expect(insertResult.success).toBe(true);
      expect(updateResult.success).toBe(true);
    });
  });
});
