export type StudyEntry = {
  id: string;
  date: string;
  person: string;
  subject: string;
  topic: string;
  minutes: number;
  tests: number;
  problems: number;
  notes: string;
  createdAt: number;
};

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return new Date(2000, 0, 1, 12);
  return new Date(year, month - 1, day, 12);
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() + amount);
  return result;
}

export function getMonthDays(month: Date): Date[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  start.setDate(1 - ((start.getDay() + 6) % 7));
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7)) % 7);
  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

export function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

export function sumMinutes(entries: Pick<StudyEntry, "minutes">[]): number {
  return entries.reduce((total, entry) => total + entry.minutes, 0);
}

export function parseStudyEntries(raw: string | null): StudyEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(isStudyEntry);
  } catch {
    return [];
  }
}

function isStudyEntry(value: unknown): value is StudyEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StudyEntry>;
  return typeof entry.id === "string"
    && typeof entry.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && typeof entry.subject === "string"
    && typeof entry.topic === "string"
    && Number.isFinite(entry.minutes)
    && Number.isFinite(entry.tests)
    && Number.isFinite(entry.problems)
    && typeof entry.notes === "string"
    && Number.isFinite(entry.createdAt);
}