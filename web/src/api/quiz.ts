// API: final test.
import { get, post, put } from './client';
import type { AnswerInput, Attempt, QuizOverview } from '@/types';

export const overview = (courseId: string) => get<QuizOverview>(`/courses/${courseId}/quiz`);
export const start = (courseId: string) => post<Attempt>(`/courses/${courseId}/quiz/start`);
export const attempt = (id: string) => get<Attempt>(`/attempts/${id}`);
export const save = (id: string, answers: AnswerInput[]) => put<{ ok: true; savedAt: string }>(`/attempts/${id}/answers`, { answers });
export const submit = (id: string, answers: AnswerInput[]) => post<{ late: boolean; attempt: Attempt }>(`/attempts/${id}/submit`, { answers });
