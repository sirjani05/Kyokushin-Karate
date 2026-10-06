export type AccountRole = "student" | "sensei";
export type TrialStatus =
  | "requested"
  | "contacted"
  | "trial_scheduled"
  | "enrolled"
  | "cancelled";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Record<string, unknown> & Row;
  Insert: Record<string, unknown> & Insert;
  Update: Record<string, unknown> & Update;
  Relationships: [];
};

export interface Profile {
  id: string;
  display_name: string;
  role: AccountRole;
  bio: string;
  rank: string;
  years_experience: number | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dojo {
  id: string;
  sensei_id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  phone: string;
  public_email: string;
  website: string;
  cover_path: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface DojoSchedule {
  id: string;
  dojo_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  class_name: string;
  age_group: string;
  created_at: string;
}

export interface DojoPricing {
  id: string;
  dojo_id: string;
  name: string;
  description: string;
  monthly_price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrialRequest {
  id: string;
  dojo_id: string;
  sensei_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_phone: string;
  preferred_date: string | null;
  message: string;
  status: TrialStatus;
  sensei_notes: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentVideo {
  id: string;
  sensei_id: string;
  dojo_id: string | null;
  title: string;
  description: string;
  storage_path: string;
  thumbnail_path: string | null;
  event_name: string;
  recorded_on: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface BeltStory {
  id: string;
  sensei_id: string;
  dojo_id: string | null;
  title: string;
  story: string;
  student_display_name: string;
  belt_from: string;
  belt_to: string;
  promoted_on: string | null;
  image_path: string | null;
  student_consented: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface BeltProgression {
  id: string;
  student_id: string;
  dojo_id: string;
  sensei_id: string;
  belt_name: string;
  promoted_on: string;
  notes: string;
  created_at: string;
}

export interface VideoBookmark {
  student_id: string;
  video_id: string;
  created_at: string;
}

type ProfileInsert = Partial<Omit<Profile, "role">> & Pick<Profile, "id">;
type DojoInsert = Partial<Omit<Dojo, "id" | "created_at" | "updated_at">> &
  Pick<Dojo, "sensei_id" | "name">;
type ScheduleInsert = Partial<Omit<DojoSchedule, "id" | "created_at">> &
  Pick<DojoSchedule, "dojo_id" | "day_of_week" | "starts_at" | "ends_at" | "class_name">;
type PricingInsert = Partial<Omit<DojoPricing, "id" | "created_at" | "updated_at">> &
  Pick<DojoPricing, "dojo_id" | "name" | "monthly_price">;
type TrialRequestInsert = Partial<
  Omit<TrialRequest, "id" | "created_at" | "updated_at" | "sensei_id">
> &
  Pick<TrialRequest, "dojo_id" | "student_id" | "student_name" | "student_email">;
type TournamentVideoInsert = Partial<
  Omit<TournamentVideo, "id" | "created_at" | "updated_at">
> &
  Pick<TournamentVideo, "sensei_id" | "title" | "storage_path">;
type BeltStoryInsert = Partial<Omit<BeltStory, "id" | "created_at" | "updated_at">> &
  Pick<BeltStory, "sensei_id" | "title">;
type BeltProgressionInsert = Partial<Omit<BeltProgression, "id" | "created_at">> &
  Pick<BeltProgression, "student_id" | "dojo_id" | "sensei_id" | "belt_name" | "promoted_on">;
type VideoBookmarkInsert = Pick<VideoBookmark, "student_id" | "video_id"> &
  Partial<Pick<VideoBookmark, "created_at">>;

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile, ProfileInsert>;
      dojos: Table<Dojo, DojoInsert>;
      dojo_schedules: Table<DojoSchedule, ScheduleInsert>;
      dojo_pricing: Table<DojoPricing, PricingInsert>;
      trial_requests: Table<TrialRequest, TrialRequestInsert>;
      tournament_videos: Table<TournamentVideo, TournamentVideoInsert>;
      belt_stories: Table<BeltStory, BeltStoryInsert>;
      belt_progressions: Table<BeltProgression, BeltProgressionInsert>;
      video_bookmarks: Table<VideoBookmark, VideoBookmarkInsert>;
    };
    Views: Record<string, never>;
    Functions: {
      is_sensei: { Args: Record<string, never>; Returns: boolean };
      owns_dojo: { Args: { target_dojo_id: string }; Returns: boolean };
    };
    Enums: {
      account_role: AccountRole;
      trial_status: TrialStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
