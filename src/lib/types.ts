
import { Timestamp } from "firebase/firestore";

export interface PhotoItem {
  id: string;
  url: string;
  caption: string;
}

export interface Anniversary {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd format
  isLunar?: boolean;
  repeat?: boolean;
  notification?: 'none' | 'one_month_before' | 'one_week_before' | 'always';
}

export interface VisionItem {
  id: string;
  term: 'short' | 'mid' | 'long';
  content: string;
}

export interface UserMembership {
  organizationId: string;
  organizationName: string;
  role: 'member' | 'admin';
  joinedAt: Timestamp | any;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string; // The chosen name to show (either realName or nickname)
  realName: string;
  nickname: string;
  useNicknameAsDisplay: boolean; // Flag to determine display name preference
  email: string;
  profilePictureUrl: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
  nationality?: string;
  createdAt: Timestamp | any;
  lastSeenAt: Timestamp | any;
  status: 'active' | 'suspended' | 'deleted';
  isAdmin?: boolean; // Super Admin
  isGroupAdmin?: boolean; // Access flag for Org Admin Center
  group?: string; // Legacy field
  memberships: UserMembership[];
  membershipIds: string[]; // For security rules and querying
  language?: string;
  storyWithGod?: {
    beliefStart?: string;
    faithStage?: 'new' | 'growing' | 'leader' | 'not_sure';
  };
  calling?: string;
  mission?: string;
  longTermVision?: VisionItem[];
  anniversaries?: Anniversary[];
  recommendedPassages?: string[];
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video';
  content: string;
  config?: {
    fontSize?: string;
    color?: string;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontWeight?: string;
  };
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  type: 'Church' | 'Group';
  mainAdminId?: string; // UID of the primary admin
  mainAdminEmail?: string;
  orgPhone: string;
  address: string;
  philosophy?: string; // 설립 목적
  vision?: string; // 비전
  ministryDirection?: string; // 사역 방향
  theology?: string; // 신학적 배경
  status: 'active' | 'archived';
  createdAt: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export interface SmallGroup {
  id: string;
  name: string;
  description?: string;
  leaderId?: string;
  leaderName?: string;
  memberIds: string[];
  createdAt: Timestamp | any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  type: 'text' | 'image' | 'file' | 'youtube';
  createdAt: Timestamp | any;
  expiresAt: Timestamp | any;
}

export interface CommunityNews {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp | any;
}

export interface OrgEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd (event date)
  time: string;
  materialBlocks: ContentBlock[];
  promotionStartType: '1week' | '2weeks' | 'custom' | 'none';
  customPromotionStartDate?: string; // yyyy-MM-dd
  createdAt: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export interface OrgDailyContent {
  id: string; // yyyy-MM-dd
  passage?: string;
  title?: string;
  verses?: string;
  paragraphs?: { range: string; title: string }[];
  analysis?: string;
  meditationGuide?: string;
  questions?: string[];
  materialTitle?: string;
  materialContent?: string;
  materialUrl?: string;
  materialBlocks?: ContentBlock[];
  schedules?: ScheduleItem[];
  updatedAt?: Timestamp | any;
}

export interface GlobalBibleSegment {
  id: string; // composite key: {lang}_{passageId}
  passage: string;
  language: string;
  title: string;
  verses: string;
  analysis: string;
  meditationGuide: string;
  questions: string[];
  paragraphs: { range: string; title: string }[];
  keyVerses: string[];
  usageCount: number;
  lastGeneratedAt: Timestamp | any;
}

export interface InvitationCode {
  id: string;
  code: string;
  organizationId: string;
  creatorId: string;
  createdAt: Timestamp | any;
  usageLimit: number;
  timesUsed: number;
  status: 'active' | 'expired' | 'disabled';
  updatedAt?: Timestamp | any;
}

export interface Person {
  id: string;
  userId: string;
  name: string;
  birthDate?: string;
  birthDateIsLunar?: boolean;
  relationship?: string;
  comment?: string;
  avatarUrl?: string;
  createdAt: Timestamp | any;
  order?: number;
  showBirthdayOnCalendar?: boolean;
  birthdayNotifications?: ('2weeks' | '1week' | '1day')[];
  notifyOnBirthday?: boolean; // Legacy
  isFavorite?: boolean;
}

export interface QTEntry {
  title: string;
  passage: string;
  segmentId?: string;
  analyzedPassage?: string;
  myMeditation: string;
  meditationGuide?: string;
  verses?: string;
  analysis?: string;
  paragraphs?: { range: string; title: string }[];
  questions?: string[];
  questionAnswers?: string[];
  keyVerses?: string[];
  evaluation?: string;
  missionTasks?: {
    question: string;
    completed: 'yes' | 'no' | 'pending';
  }[];
}

export enum PrayerStatus {
  InProgress = '기도중',
  Answered = '응답됨',
  Declined = '거절',
  Waiting = '기다림',
}

export interface PrayerFeedback {
  id: string;
  content: string;
  createdAt: Timestamp | Date;
}

export interface PrayerItem {
  id: string;
  title: string;
  status: PrayerStatus;
  feedbacks: PrayerFeedback[];
  createdAt: Timestamp | Date;
  personId?: string;
}

export interface GratitudeFeedback {
  id: string;
  content: string;
  createdAt: Timestamp | Date;
}

export interface GratitudeItem {
  id: string;
  title: string;
  feedbacks: GratitudeFeedback[];
  createdAt: Timestamp | Date;
  personId?: string;
}

export interface ExpenditureItem {
  id: string;
  title: string;
  amount: number;
  personId?: string;
  createdAt: Timestamp | Date;
}

export interface DailyCheck {
  closenessToGod: number;
  relationships: number;
  innerPeace: number;
  senseOfPurpose: number;
  thankfulness: number;
}

export interface ReflectionData {
  dailySummary: string;
  godExperience: string;
  hardestMoment: string;
  obedienceRepentance: string;
  missionAlignment: string;
  missionAlignmentChoice: 'yes' | 'no' | 'unsure' | '';
  gratitudeJournal: string;
  gratitudeJournalAudioUrl?: string;
  dailyAiReflection?: string;
  photos?: PhotoItem[];
  // Legacy
  imageUrl?: string;
  photoCaption?: string;
}

export interface ScheduleItem {
  id: string;
  time: string; // e.g., "09:00 오전"
  content: string;
}

export interface TimeStewardSegment {
  id: string;
  category: string;
  content?: string;
  startHour: number;
  endHour: number;
}

export interface PeopleInteraction {
  id: string;
  personId: string;
  note: string;
}

export interface DiaryData {
  dailyCheck: DailyCheck;
  reflection: ReflectionData;
  prayers?: PrayerItem[];
  todaysSchedule?: ScheduleItem[];
  gratitudes?: GratitudeItem[];
  expenditures?: ExpenditureItem[];
  timeSteward?: TimeStewardSegment[];
  peopleInteractions?: PeopleInteraction[];
}

export interface DayData {
  date: string;
  qt: QTEntry;
  diary: DiaryData;
  completed?: boolean;
  diaryCompleted?: boolean;
  updatedAt?: Timestamp | any;
}

export interface FeedbackReply {
  id: string;
  userId: string;
  userDisplayName: string;
  text: string;
  createdAt: Timestamp | any;
}

export interface FeedbackItem {
  id: string;
  userId: string;
  userDisplayName: string;
  userProfilePictureUrl: string;
  rating: number;
  comment: string;
  createdAt: Timestamp | any;
}

export interface BibleSegmentContent {
  id?: string;
  verses?: string;
  keyVerses?: string[];
  paragraphs?: { range: string; title: string }[];
  analysis?: string;
  questions?: string[];
  meditationGuide?: string;
}

export interface BibleSegment {
  id: string;
  range: string;
  title: string;
}

export interface ForumPost {
  id: string;
  userId: string;
  userDisplayName: string;
  userProfilePictureUrl: string;
  passage: string;
  bookKey: string;
  chapter: number;
  meditation: string;
  createdAt: Timestamp | any;
  reactions?: Record<string, string[]>;
  sharedFromDate: string;
}

export interface PrayerPost {
  id: string;
  userId: string;
  userDisplayName: string;
  userProfilePictureUrl: string;
  title: string;
  category: 'church' | 'small_group';
  organizationId?: string;
  organizationName?: string;
  groupId?: string;
  groupName?: string;
  createdAt: Timestamp | any;
  amens?: string[];
  sharedFromDate: string;
  originalPrayerId: string;
  visibility?: 'public' | 'private';
}
