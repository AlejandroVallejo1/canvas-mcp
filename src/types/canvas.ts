// Canvas LMS API Response Types

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  account_id: number;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  enrollments?: CanvasEnrollment[];
  total_students?: number;
  teachers?: CanvasUser[];
  syllabus_body?: string;
  term?: CanvasTerm;
  time_zone?: string;
  default_view?: string;
}

export interface CanvasTerm {
  id: number;
  name: string;
  start_at: string | null;
  end_at: string | null;
}

export interface CanvasEnrollment {
  id: number;
  course_id: number;
  user_id: number;
  type: string;
  enrollment_state: string;
  role: string;
  grades?: CanvasGrade;
  computed_current_score?: number | null;
  computed_final_score?: number | null;
  computed_current_grade?: string | null;
  computed_final_grade?: string | null;
  user?: CanvasUser;
}

export interface CanvasGrade {
  html_url: string;
  current_score: number | null;
  current_grade: string | null;
  final_score: number | null;
  final_grade: string | null;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  lock_at: string | null;
  unlock_at: string | null;
  course_id: number;
  points_possible: number;
  grading_type: string;
  submission_types: string[];
  has_submitted_submissions: boolean;
  html_url: string;
  published: boolean;
  submission?: CanvasSubmission;
  rubric?: CanvasRubricCriterion[];
  rubric_settings?: CanvasRubricSettings;
  allowed_extensions?: string[];
  position: number;
  needs_grading_count?: number;
}

export interface CanvasRubricCriterion {
  id: string;
  description: string;
  long_description?: string;
  points: number;
  ratings: CanvasRubricRating[];
}

export interface CanvasRubricRating {
  id: string;
  description: string;
  long_description?: string;
  points: number;
}

export interface CanvasRubricSettings {
  id: number;
  title: string;
  points_possible: number;
  free_form_criterion_comments: boolean;
}

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submission_type: string | null;
  submitted_at: string | null;
  score: number | null;
  grade: string | null;
  attempt: number | null;
  workflow_state: string;
  late: boolean;
  missing: boolean;
  excused: boolean | null;
  grade_matches_current_submission: boolean;
  body?: string | null;
  url?: string | null;
  preview_url?: string;
  submission_comments?: CanvasSubmissionComment[];
  rubric_assessment?: Record<string, CanvasRubricAssessment>;
  attachments?: CanvasFile[];
}

export interface CanvasSubmissionComment {
  id: number;
  author_id: number;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface CanvasRubricAssessment {
  points: number;
  rating_id?: string;
  comments?: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  unlock_at: string | null;
  require_sequential_progress: boolean;
  publish_final_grade: boolean;
  prerequisite_module_ids: number[];
  state?: string;
  completed_at?: string | null;
  items_count: number;
  items_url: string;
  items?: CanvasModuleItem[];
}

export interface CanvasModuleItem {
  id: number;
  module_id: number;
  position: number;
  title: string;
  type: string;
  content_id?: number;
  html_url?: string;
  url?: string;
  external_url?: string;
  page_url?: string;
  indent: number;
  completion_requirement?: {
    type: string;
    completed: boolean;
    min_score?: number;
  };
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  delayed_post_at: string | null;
  context_code: string;
  author: {
    id: number;
    display_name: string;
    avatar_image_url?: string;
  };
  read_state?: string;
  attachments?: CanvasFile[];
}

export interface CanvasConversation {
  id: number;
  subject: string;
  workflow_state: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
  participants: CanvasConversationParticipant[];
  audience: number[];
  messages?: CanvasMessage[];
  context_name?: string;
}

export interface CanvasConversationParticipant {
  id: number;
  name: string;
  full_name?: string;
  avatar_url?: string;
}

export interface CanvasMessage {
  id: number;
  created_at: string;
  body: string;
  author_id: number;
  forwarded_messages?: CanvasMessage[];
  attachments?: CanvasFile[];
  participating_user_ids?: number[];
}

export interface CanvasFile {
  id: number;
  uuid: string;
  folder_id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  modified_at: string;
  'content-type': string;
  locked: boolean;
  hidden: boolean;
  thumbnail_url?: string;
}

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  context_id: number;
  context_type: string;
  parent_folder_id: number | null;
  files_count: number;
  folders_count: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasPage {
  page_id: number;
  url: string;
  title: string;
  body?: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  front_page: boolean;
  editing_roles?: string;
}

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  description: string | null;
  context_code: string;
  workflow_state: string;
  all_day: boolean;
  all_day_date?: string;
  type: string;
  html_url?: string;
  assignment?: CanvasAssignment;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  last_reply_at: string | null;
  discussion_subentry_count: number;
  read_state: string;
  unread_count: number;
  assignment_id: number | null;
  author: {
    id: number;
    display_name: string;
    avatar_image_url?: string;
  };
  published: boolean;
  html_url: string;
}

export interface CanvasDiscussionEntry {
  id: number;
  user_id: number;
  user_name: string;
  message: string;
  created_at: string;
  updated_at: string;
  read_state: string;
  recent_replies?: CanvasDiscussionEntry[];
  has_more_replies?: boolean;
}

export interface CanvasQuiz {
  id: number;
  title: string;
  description: string | null;
  quiz_type: string;
  time_limit: number | null;
  allowed_attempts: number;
  points_possible: number | null;
  due_at: string | null;
  lock_at: string | null;
  unlock_at: string | null;
  published: boolean;
  html_url: string;
  question_count: number;
  show_correct_answers: boolean;
}

export interface CanvasQuizSubmission {
  id: number;
  quiz_id: number;
  user_id: number;
  submission_id: number;
  started_at: string;
  finished_at: string | null;
  end_at: string | null;
  attempt: number;
  score: number | null;
  kept_score: number | null;
  workflow_state: string;
  time_spent?: number;
}

export interface CanvasUser {
  id: number;
  name: string;
  sortable_name?: string;
  short_name?: string;
  login_id?: string;
  email?: string;
  avatar_url?: string;
  bio?: string | null;
  enrollments?: CanvasEnrollment[];
}

export interface CanvasActivityStreamItem {
  id: number;
  title: string;
  message: string | null;
  type: string;
  context_type: string;
  course_id?: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  read_state: boolean;
}

export interface CanvasTodoItem {
  type: string;
  assignment?: CanvasAssignment;
  context_type: string;
  course_id: number;
  html_url: string;
  needs_grading_count?: number;
}

export interface CanvasSection {
  id: number;
  name: string;
  course_id: number;
  start_at: string | null;
  end_at: string | null;
  total_students?: number;
}

export interface CanvasRecipient {
  id: number | string;
  name: string;
  full_name?: string;
  common_courses?: Record<string, string[]>;
  common_groups?: Record<string, string[]>;
  avatar_url?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextPage: string | null;
}
