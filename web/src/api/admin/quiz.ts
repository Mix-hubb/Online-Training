// API: final-test editor. Same routes under /admin (ADMIN) and /instructor (assigned instructor, 2026-11-22).
import { del, get, patch, post, put } from '../client';
import type { AdminQuestion } from './courses';

export interface QuizSettings {
  passPercent: number;
  timeLimitMin: number | null;
  maxAttempts: number;
}
export interface QuestionInput {
  type: 'MCQ' | 'ESSAY';
  text: string;
  points: number;
  options: { text: string; isCorrect: boolean }[];
}
export type QuizView = (QuizSettings & { id: string; questions: AdminQuestion[] }) | null;
export type QuizBase = '/admin' | '/instructor';

export function quizApi(base: QuizBase) {
  return {
    getQuiz: (courseId: string) => get<QuizView>(`${base}/courses/${courseId}/quiz`),
    saveSettings: (courseId: string, s: QuizSettings) => put<QuizView>(`${base}/courses/${courseId}/quiz`, s),
    addQuestion: (quizId: string, q: QuestionInput) => post<AdminQuestion>(`${base}/quiz/${quizId}/questions`, q),
    updateQuestion: (id: string, q: QuestionInput) => patch<AdminQuestion>(`${base}/questions/${id}`, q),
    removeQuestion: (id: string) => del(`${base}/questions/${id}`),
    reorderQuestions: (quizId: string, ids: string[]) => put(`${base}/quiz/${quizId}/questions/order`, { ids }),
  };
}
export const { getQuiz, saveSettings, addQuestion, updateQuestion, removeQuestion, reorderQuestions } = quizApi('/admin');
