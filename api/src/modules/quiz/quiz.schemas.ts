// Zod schemas.
import { z } from 'zod';

export const answerItem = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1).nullable().optional(),
  essayText: z.string().max(10000).nullable().optional(),
});

export const answersBody = z.object({ answers: z.array(answerItem).max(500) });
export type AnswerInput = z.infer<typeof answerItem>;

export const gradeBody = z.object({
  grades: z
    .array(
      z.object({
        questionId: z.string().min(1),
        points: z.number().int().min(0),
        comment: z.string().max(2000).optional(),
      }),
    )
    .min(1),
});
