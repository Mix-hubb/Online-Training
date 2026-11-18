// Lesson lock order + quiz unlock (spec section 4).
// Lesson N+1 is unlocked only when lesson N is completed in the CURRENT cycle.
// The quiz is unlocked only when ALL lessons are completed.

export interface LessonState {
  lessonId: string;
  completed: boolean;
  unlocked: boolean;
}

export function lessonStates(lessonIdsInOrder: string[], completedIds: Set<string>): LessonState[] {
  let prevDone = true;
  return lessonIdsInOrder.map((id) => {
    const completed = completedIds.has(id);
    const state = { lessonId: id, completed, unlocked: prevDone };
    prevDone = prevDone && completed;
    return state;
  });
}

export function quizUnlocked(lessonIdsInOrder: string[], completedIds: Set<string>): boolean {
  return lessonIdsInOrder.length > 0 && lessonIdsInOrder.every((id) => completedIds.has(id));
}
