// API: enrollment, player, progress.
import { get, post, put } from './client';
import type { LearnData, MyCourse, PlayInfo } from '@/types';

export const enroll = (courseId: string) => post<{ enrollmentId: string }>(`/courses/${courseId}/enroll`);
export const myCourses = () => get<MyCourse[]>('/me/courses');
export const continueLearning = () => get<MyCourse[]>('/me/continue');
export const learn = (slug: string) => get<LearnData>(`/courses/${slug}/learn`);
export const play = (lessonId: string) => get<PlayInfo>(`/lessons/${lessonId}/play`);
export const progress = (lessonId: string, position: number, watchedDelta: number) =>
  put<{ watchedSec: number; lastPositionSec: number; completed: boolean }>(`/lessons/${lessonId}/progress`, { position, watchedDelta });
