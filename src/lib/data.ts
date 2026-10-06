import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BeltProgression,
  BeltStory,
  Database,
  Dojo,
  DojoPricing,
  DojoSchedule,
  Profile,
  TournamentVideo,
  TrialRequest,
} from "./database.types";

export type AppDatabase = SupabaseClient<Database>;

export async function getProfile(client: AppDatabase, userId: string): Promise<Profile> {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function getPublishedDojos(client: AppDatabase): Promise<Dojo[]> {
  const { data, error } = await client
    .from("dojos")
    .select("*")
    .eq("is_published", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getSenseiDojos(client: AppDatabase, senseiId: string): Promise<Dojo[]> {
  const { data, error } = await client
    .from("dojos")
    .select("*")
    .eq("sensei_id", senseiId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getDojoSchedules(
  client: AppDatabase,
  dojoId: string,
): Promise<DojoSchedule[]> {
  const { data, error } = await client
    .from("dojo_schedules")
    .select("*")
    .eq("dojo_id", dojoId)
    .order("day_of_week")
    .order("starts_at");
  if (error) throw error;
  return data;
}

export async function getDojoPricing(client: AppDatabase, dojoId: string): Promise<DojoPricing[]> {
  const { data, error } = await client
    .from("dojo_pricing")
    .select("*")
    .eq("dojo_id", dojoId)
    .eq("is_active", true)
    .order("monthly_price");
  if (error) throw error;
  return data;
}

export async function getSenseiLeads(
  client: AppDatabase,
  senseiId: string,
): Promise<TrialRequest[]> {
  const { data, error } = await client
    .from("trial_requests")
    .select("*")
    .eq("sensei_id", senseiId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getStudentTrials(
  client: AppDatabase,
  studentId: string,
): Promise<TrialRequest[]> {
  const { data, error } = await client
    .from("trial_requests")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSenseiVideos(
  client: AppDatabase,
  senseiId: string,
): Promise<TournamentVideo[]> {
  const { data, error } = await client
    .from("tournament_videos")
    .select("*")
    .eq("sensei_id", senseiId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPublicStories(client: AppDatabase): Promise<BeltStory[]> {
  const { data, error } = await client
    .from("belt_stories")
    .select("*")
    .eq("is_published", true)
    .order("promoted_on", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPublicVideos(client: AppDatabase): Promise<TournamentVideo[]> {
  const { data, error } = await client
    .from("tournament_videos")
    .select("*")
    .eq("is_published", true)
    .order("recorded_on", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSenseiStories(
  client: AppDatabase,
  senseiId: string,
): Promise<BeltStory[]> {
  const { data, error } = await client
    .from("belt_stories")
    .select("*")
    .eq("sensei_id", senseiId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBeltProgression(
  client: AppDatabase,
  studentId: string,
): Promise<BeltProgression[]> {
  const { data, error } = await client
    .from("belt_progressions")
    .select("*")
    .eq("student_id", studentId)
    .order("promoted_on", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSenseiBeltProgression(
  client: AppDatabase,
  senseiId: string,
): Promise<BeltProgression[]> {
  const { data, error } = await client
    .from("belt_progressions")
    .select("*")
    .eq("sensei_id", senseiId)
    .order("promoted_on", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSignedMediaUrl(
  client: AppDatabase,
  bucket: string,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
