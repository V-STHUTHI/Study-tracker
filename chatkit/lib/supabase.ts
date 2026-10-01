import { createClient } from "@supabase/supabase-js";
import type { StudyEntry } from "@/lib/study-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type StudyEntryRow = {
  id: string;
  date: string;
  person: string;
  subject: string;
  topic: string;
  minutes: number;
  tests: number;
  problems: number;
  notes: string;
  created_at: number;
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://missing-supabase-config.example",
  supabaseAnonKey || "missing-supabase-anon-key",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  }
);

export function toSupabaseEntry(entry: StudyEntry): StudyEntryRow {
  return {
    id: entry.id,
    date: entry.date,
    person: entry.person,
    subject: entry.subject,
    topic: entry.topic,
    minutes: entry.minutes,
    tests: entry.tests,
    problems: entry.problems,
    notes: entry.notes,
    created_at: entry.createdAt,
  };
}

export function fromSupabaseEntry(row: StudyEntryRow): StudyEntry {
  return {
    id: row.id,
    date: row.date,
    person: row.person,
    subject: row.subject,
    topic: row.topic,
    minutes: row.minutes,
    tests: row.tests,
    problems: row.problems,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function fetchStudyEntriesFromSupabase(): Promise<StudyEntry[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("study_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => fromSupabaseEntry(row as StudyEntryRow));
}

export async function upsertStudyEntriesToSupabase(entries: StudyEntry[]): Promise<void> {
  if (!isSupabaseConfigured || entries.length === 0) return;

  const { error } = await supabase
    .from("study_entries")
    .upsert(entries.map((entry) => toSupabaseEntry(entry)), {
      onConflict: "id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("Supabase upsert failed:", error.message);
    throw error;
  }
}

export async function clearStudyEntriesInSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from("study_entries").delete().neq("id", "");

  if (error) {
    console.error("Supabase delete failed:", error.message);
    throw error;
  }
}
