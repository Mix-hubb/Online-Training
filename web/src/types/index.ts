// Shared API types (mirror the api responses).

export type Role = 'USER' | 'INSTRUCTOR' | 'PARTNER' | 'ADMIN';
export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type Currency = 'usd' | 'thb';
export type PayMethod = 'card' | 'promptpay' | 'bank' | 'btc';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  emailVerified: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  partner: { id: string; name: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface Taxon {
  id: string;
  name: string;
  slug: string;
}

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  thumbnailUrl: string | null;
  level: Level;
  status: CourseStatus;
  isFree: boolean;
  priceMinor: number;
  currency: string;
  priceThbMinor: number | null;
  category: Taxon | null;
  tags: Taxon[];
  lessonCount: number;
  durationSec: number;
  instructors: { id: string; name: string; avatarUrl: string | null }[];
}

export interface MethodOption {
  method: PayMethod;
  currency: Currency;
  amountMinor: number;
}

export interface CourseDetail extends CourseCard {
  description: string;
  outcomes: string[];
  hasIntroVideo: boolean;
  lessons: { id: string; order: number; title: string; description: string | null; durationSec: number }[];
  quiz: { questionCount: number; passPercent: number; timeLimitMin: number | null; maxAttempts: number } | null;
  paymentMethods: MethodOption[];
  viewer: {
    enrolled: boolean;
    enrollmentStatus: 'IN_PROGRESS' | 'COMPLETED' | null;
    lastLessonId: string | null;
    pendingOrder: { id: string; status: string; provider: string; method: string | null } | null;
  } | null;
}

export type LearningStatus = 'IN_PROGRESS' | 'READY_FOR_TEST' | 'WAITING_FOR_INSTRUCTOR' | 'LESSONS_RESTARTED' | 'COMPLETED';

export interface MyCourse {
  enrollmentId: string;
  course: { id: string; slug: string; title: string; thumbnailUrl: string | null; status: CourseStatus };
  status: LearningStatus;
  cycle: number;
  completedLessons: number;
  totalLessons: number;
  percent: number;
  lastLesson: { id: string; title: string } | null;
  lastActivity: string;
  certificate: { id: string; number: string } | null;
}

export interface LearnLesson {
  id: string;
  order: number;
  title: string;
  description: string | null;
  durationSec: number;
  videoStatus: 'PROCESSING' | 'READY' | 'FAILED';
  attachmentUrls: string[];
  unlocked: boolean;
  completed: boolean;
  watchedSec: number;
  lastPositionSec: number;
}

export interface LearnData {
  preview: boolean;
  course: { id: string; slug: string; title: string; status: CourseStatus };
  enrollment: { id: string; status: string; cycle: number; lastLessonId: string | null } | null;
  lessons: LearnLesson[];
  quiz: {
    questionCount: number;
    passPercent: number;
    timeLimitMin: number | null;
    maxAttempts: number;
    attemptsUsed: number;
    unlocked: boolean;
  } | null;
}

export interface PlayInfo {
  url: string;
  expiresAt: string;
  qualities: number[];
  resumeAt: number;
  durationSec: number;
}

export interface QuizOverview {
  quizId: string;
  questionCount: number;
  passPercent: number;
  timeLimitMin: number | null;
  maxAttempts: number;
  unlocked: boolean;
  passed: boolean;
  cycle: number;
  attemptsUsed: number;
  attemptsLeft: number;
  openAttemptId: string | null;
  pendingReview: boolean;
  history: { id: string; cycle: number; status: AttemptStatus; startedAt: string; submittedAt: string | null; score: number | null; maxScore: number | null; passed: boolean | null }[];
}

export type AttemptStatus = 'IN_PROGRESS' | 'PENDING_REVIEW' | 'GRADED';

export interface AttemptQuestion {
  id: string;
  order: number;
  type: 'MCQ' | 'ESSAY';
  text: string;
  points: number;
  options: { id: string; text: string }[];
}

export interface ReviewItem {
  id: string;
  order: number;
  type: 'MCQ' | 'ESSAY';
  text: string;
  points: number;
  options: { id: string; text: string; isCorrect: boolean }[];
  yourOptionId: string | null;
  yourEssay: string | null;
  correctOptionId: string | null;
  pointsAwarded: number;
  isRight: boolean;
  comment: string | null;
}

export interface Attempt {
  id: string;
  status: AttemptStatus;
  cycle: number;
  startedAt: string;
  submittedAt: string | null;
  deadline: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
  passPercent: number;
  attemptsLeft: number;
  questions?: AttemptQuestion[];
  answers?: { questionId: string; optionId: string | null; essayText: string | null }[];
  review?: ReviewItem[];
}

export interface AnswerInput {
  questionId: string;
  optionId?: string | null;
  essayText?: string | null;
}

export interface Order {
  id: string;
  status: 'PENDING' | 'AWAITING_SLIP' | 'PAID' | 'FAILED';
  amountMinor: number;
  currency: string;
  provider: 'STRIPE' | 'BANK_TRANSFER' | 'CRYPTO';
  method: string | null;
  receiptUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  course?: { title: string; slug: string; thumbnailUrl?: string | null };
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  note?: string;
  placeholder: boolean;
}

export interface Slip {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  url: string;
}

export interface AppNotification {
  id: string;
  text: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CertificateVerify {
  number: string;
  name: string;
  course: string;
  courseSlug: string;
  issuedAt: string;
  valid: boolean;
}

export interface Landing {
  banners: { id: string; imageUrl: string; linkUrl: string | null; altText: string | null }[];
  sections: Record<string, { content: Record<string, unknown>; isVisible: boolean; order: number }>;
  partners: { id: string; name: string; logoUrl: string | null; websiteUrl: string | null }[];
}

export interface ThreadSummary {
  id: string;
  type: 'SUPPORT' | 'COURSE';
  subject: string;
  status: 'OPEN' | 'CLOSED';
  lastMessageAt: string;
  learner?: { id: string; name: string; avatarUrl: string | null };
  course: { id: string; title: string; slug: string } | null;
  lastMessage: { body: string; at: string } | null;
  unread: number;
}

export interface Attachment {
  id: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  fromStaff?: boolean;
  sender?: { id: string; name: string; avatarUrl: string | null; role: Role };
  attachments: Attachment[];
}

export interface ThreadDetail {
  thread: {
    id: string;
    type: 'SUPPORT' | 'COURSE';
    subject: string;
    status: 'OPEN' | 'CLOSED';
    course: { id: string; title: string; slug: string } | null;
    learner?: { id: string; name: string; avatarUrl: string | null };
  };
  side: 'learner' | 'staff';
  messages: ChatMessage[];
}

export interface FileUpload {
  name?: string;
  dataBase64: string;
}

export interface RevenueRow {
  id: string;
  date: string;
  partnerId?: string;
  partnerName?: string;
  courseId: string;
  courseTitle: string;
  orderRef: string;
  currency: string;
  baseMinor: number;
  percentBp: number;
  amountMinor: number;
  status: 'UNPAID' | 'PAID';
  payout: { id: string; paidAt: string; reference: string | null } | null;
}

export type RevenueTotals = Record<string, { earned: number; paid: number; outstanding: number }>;

export interface Payout {
  id: string;
  partnerId: string;
  currency: string;
  totalMinor: number;
  periodFrom: string | null;
  periodTo: string | null;
  paidAt: string;
  reference: string | null;
  note: string | null;
  partner?: { id: string; name: string };
  _count?: { entries: number };
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
