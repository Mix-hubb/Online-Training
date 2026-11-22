// Stable error codes returned to the web app (spec section 7).
// Throw `new AppError('LOCKED', 403)` from services; error-handler turns it into JSON.
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'BANNED'
  | 'EMAIL_NOT_VERIFIED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'NOT_ENROLLED'
  | 'ALREADY_ENROLLED'
  | 'COURSE_UNAVAILABLE'
  | 'LOCKED'
  | 'QUIZ_LOCKED'
  | 'NO_ATTEMPTS_LEFT'
  | 'ATTEMPT_EXPIRED'
  | 'ATTEMPT_ALREADY_SUBMITTED'
  | 'NOT_FREE'
  | 'INSTRUCTOR_LIMIT'
  | 'NOT_ASSIGNED'
  | 'ATTACHMENT_TOO_LARGE'
  | 'TOO_MANY_ATTACHMENTS'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'PAYMENT_METHOD_UNAVAILABLE'
  | 'SLIP_ALREADY_REVIEWED'
  | 'MUST_CHANGE_PASSWORD'
  | 'NOT_A_PARTNER'
  | 'NOT_COMPLETED'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status = 400,
    message?: string,
  ) {
    super(message ?? code);
  }
}
