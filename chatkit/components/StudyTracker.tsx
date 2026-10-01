"use client";

import {
  BarChart3, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight,
  Download, Flame, LayoutDashboard, MoonStar, Pencil, Plus, SunMedium, Target, Trash2, X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  addDays, dateFromKey, formatMinutes, getMonthDays, localDateKey,
  parseStudyEntries, sumMinutes, type StudyEntry,
} from "@/lib/study-data";
import {
  clearStudyEntriesInSupabase,
  fetchStudyEntriesFromSupabase,
  isSupabaseConfigured,
  upsertStudyEntriesToSupabase,
} from "@/lib/supabase";

type ViewName = "overview" | "calendar" | "insights";
type EntryDraft = {
  date: string; person: string; subject: string; topic: string; hours: string;
  minutes: string; tests: string; problems: string; notes: string;
};
type WeekPoint = { key: string; label: string; dateLabel: string; minutes: number };
const STORAGE_KEY = "daymark-study-entries-v2";
const PEOPLE_STORAGE_KEY = "daymark-study-people-v1";
const THEME_STORAGE_KEY = "daymark-study-theme-v1";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "Computer science", "English", "History"];
const DEFAULT_PEOPLE = ["You", "Your BF"];

function emptyDraft(date: string, person = "You"): EntryDraft {
  return { date, person, subject: "", topic: "", hours: "", minutes: "30", tests: "0", problems: "0", notes: "" };
}

function normalizePersonName(value: string, fallback = "You"): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || fallback;
}

function normalizePeople(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_PEOPLE];
  const people = value
    .map((entry) => (typeof entry === "string" ? entry.trim().replace(/\s+/g, " ") : ""))
    .filter(Boolean);
  return Array.from(new Set(people));
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en", options).format(date);
}

function entriesForDate(entries: StudyEntry[], date: string): StudyEntry[] {
  return entries.filter((entry) => entry.date === date).sort((a, b) => b.createdAt - a.createdAt);
}

function minutesForDate(entries: StudyEntry[], date: string): number {
  return sumMinutes(entriesForDate(entries, date));
}

function makeWeekData(entries: StudyEntry[], today: string): WeekPoint[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(dateFromKey(today), index - 6);
    const key = localDateKey(date);
    return {
      key,
      label: formatDate(date, { weekday: "short" }),
      dateLabel: formatDate(date, { day: "numeric" }),
      minutes: minutesForDate(entries, key),
    };
  });
}

function makeWeekdayAverages(entries: StudyEntry[], today: string) {
  const totals = Array.from({ length: 7 }, () => ({ minutes: 0, days: 0 }));
  for (let offset = 27; offset >= 0; offset -= 1) {
    const date = addDays(dateFromKey(today), -offset);
    const weekday = (date.getDay() + 6) % 7;
    totals[weekday].minutes += minutesForDate(entries, localDateKey(date));
    totals[weekday].days += 1;
  }
  return totals.map((value, index) => ({ label: WEEKDAYS[index], average: value.minutes / value.days }));
}

function exportCsv(entries: StudyEntry[]) {
  const rows = [
    ["Date", "Person", "Subject", "Topic", "Minutes", "Tests", "Problems", "Notes"],
    ...entries.map((entry) => [entry.date, entry.person, entry.subject, entry.topic, String(entry.minutes), String(entry.tests), String(entry.problems), entry.notes]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "daymark-study-log.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function StudyTracker() {
  const [entries, setEntries] = useState<StudyEntry[]>([]);
  const [people, setPeople] = useState<string[]>(DEFAULT_PEOPLE);
  const [selectedPerson, setSelectedPerson] = useState<string>("all");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date(2000, 0, 1, 12));
  const [activeView, setActiveView] = useState<ViewName>("overview");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [peopleManagerOpen, setPeopleManagerOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft("", "You"));
  const [formError, setFormError] = useState("");
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      const currentDate = localDateKey();
      const savedPeople = normalizePeople(window.localStorage.getItem(PEOPLE_STORAGE_KEY));
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const storedEntries = parseStudyEntries(window.localStorage.getItem(STORAGE_KEY));

      let resolvedEntries = storedEntries;
      let resolvedPeople = savedPeople;

      if (isSupabaseConfigured) {
        const remoteEntries = await fetchStudyEntriesFromSupabase();
        if (remoteEntries.length > 0) {
          resolvedEntries = remoteEntries;
          resolvedPeople = normalizePeople(Array.from(new Set(remoteEntries.map((entry) => entry.person))));
        }
        setIsUsingSupabase(true);
      }

      setToday(currentDate);
      setSelectedDate(currentDate);
      setCurrentMonth(dateFromKey(currentDate));
      setPeople(resolvedPeople);
      setIsDarkMode(savedTheme === "light" ? false : true);
      setEntries(resolvedEntries);
      setIsReady(true);
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
  }, [isDarkMode, isReady]);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
    } catch {
      setFormError("Your browser could not save the profiles list. Try again.");
    }
  }, [people, isReady]);

  useEffect(() => {
    if (!isReady) return;

    if (isUsingSupabase && isSupabaseConfigured) {
      void upsertStudyEntriesToSupabase(entries).catch(() => {
        setFormError("The shared database could not sync. Check your Supabase configuration.");
      });
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      setFormError("Your browser could not save this change. Check available storage.");
    }
  }, [entries, isReady, isUsingSupabase]);

  useEffect(() => {
    if (!isReady || selectedPerson === "all") return;
    if (!people.includes(selectedPerson)) {
      setSelectedPerson("all");
    }
  }, [people, selectedPerson, isReady]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDialogOpen]);

  const visibleEntries = useMemo(
    () => selectedPerson === "all" ? entries : entries.filter((entry) => entry.person === selectedPerson),
    [entries, selectedPerson],
  );
  const week = useMemo(() => makeWeekData(visibleEntries, today || "2000-01-01"), [visibleEntries, today]);
  const weekMinutes = week.reduce((total, day) => total + day.minutes, 0);
  const todayEntries = useMemo(() => entriesForDate(visibleEntries, today), [visibleEntries, today]);
  const todayMinutes = sumMinutes(todayEntries);
  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const selectedEntries = useMemo(() => entriesForDate(visibleEntries, selectedDate), [visibleEntries, selectedDate]);
  const lastWeekEntries = useMemo(() => visibleEntries.filter((entry) => week.some((day) => day.key === entry.date)), [visibleEntries, week]);
  const subjectTotals = useMemo(() => {
    const totals = new Map<string, number>();
    lastWeekEntries.forEach((entry) => totals.set(entry.subject, (totals.get(entry.subject) ?? 0) + entry.minutes));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [lastWeekEntries]);
  const weekdayStats = useMemo(() => makeWeekdayAverages(visibleEntries, today || "2000-01-01"), [visibleEntries, today]);
  const topicCount = new Set(lastWeekEntries.map((entry) => entry.topic.trim().toLowerCase()).filter(Boolean)).size;
  const weekTests = lastWeekEntries.reduce((total, entry) => total + entry.tests, 0);
  const weekProblems = lastWeekEntries.reduce((total, entry) => total + entry.problems, 0);
  const activeDays = week.filter((day) => day.minutes > 0).length;
  const strongestDay = weekdayStats.reduce((best, day) => day.average > best.average ? day : best, weekdayStats[0] ?? { label: "-", average: 0 });
  const slowestDay = weekdayStats.reduce((lowest, day) => day.average < lowest.average ? day : lowest, weekdayStats[0] ?? { label: "-", average: 0 });

  function openNewEntry(date = selectedDate || today) {
    setEditingId(null);
    setDraft(emptyDraft(date, selectedPerson === "all" ? "You" : selectedPerson));
    setFormError("");
    setIsDialogOpen(true);
  }

  function openEditEntry(entry: StudyEntry) {
    setEditingId(entry.id);
    setDraft({
      date: entry.date,
      person: entry.person,
      subject: entry.subject,
      topic: entry.topic,
      hours: String(Math.floor(entry.minutes / 60)),
      minutes: String(entry.minutes % 60),
      tests: String(entry.tests),
      problems: String(entry.problems),
      notes: entry.notes,
    });
    setFormError("");
    setIsDialogOpen(true);
  }

  function addPerson() {
    const name = normalizePersonName(newPersonName);
    if (!name) return;
    setPeople((current) => {
      if (current.includes(name)) return current;
      return [...current, name];
    });
    setSelectedPerson(name);
    setNewPersonName("");
    setPeopleManagerOpen(false);
  }

  function removePerson(name: string) {
    if (!window.confirm(`Remove ${name} from saved names? Their study sessions will remain in the shared history.`)) return;
    setPeople((current) => current.filter((person) => person !== name));
    if (selectedPerson === name) setSelectedPerson("all");
  }

  async function resetStudyData() {
    if (!window.confirm("Clear all study data and start from zero?")) return;
    setEntries([]);
    setSelectedPerson("all");
    setPeople(DEFAULT_PEOPLE);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(DEFAULT_PEOPLE));

    if (isUsingSupabase && isSupabaseConfigured) {
      try {
        await clearStudyEntriesInSupabase();
      } catch {
        setFormError("The shared database could not be cleared. Please check the Supabase table.");
      }
    }
  }

  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const duration = Number(draft.hours || 0) * 60 + Number(draft.minutes || 0);
    const person = normalizePersonName(draft.person || "You");
    if (!draft.date || !draft.subject.trim() || !draft.topic.trim() || !person) {
      setFormError("Add a date, subject, topic, and person to save this session.");
      return;
    }
    if (!Number.isFinite(duration) || duration < 1 || duration > 1440) {
      setFormError("Enter a study duration between 1 minute and 24 hours.");
      return;
    }
    const existing = editingId ? entries.find((entry) => entry.id === editingId) : null;
    const nextEntry: StudyEntry = {
      id: editingId ?? crypto.randomUUID(),
      date: draft.date,
      person,
      subject: draft.subject.trim(),
      topic: draft.topic.trim(),
      minutes: duration,
      tests: Math.max(0, Math.floor(Number(draft.tests) || 0)),
      problems: Math.max(0, Math.floor(Number(draft.problems) || 0)),
      notes: draft.notes.trim(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    setPeople((current) => (current.includes(person) ? current : [...current, person]));
    setEntries((current) => editingId
      ? current.map((entry) => entry.id === editingId ? nextEntry : entry)
      : [...current, nextEntry]);
    setSelectedPerson("all");
    setSelectedDate(nextEntry.date);
    setCurrentMonth(dateFromKey(nextEntry.date));
    setFormError("");
    setIsDialogOpen(false);
  }

  function deleteEntry(entry: StudyEntry) {
    if (!window.confirm(`Delete the ${entry.subject} session for ${entry.person}?`)) return;
    setEntries((current) => current.filter((item) => item.id !== entry.id));
  }

  function moveMonth(amount: number) {
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1, 12));
  }

  function chooseDate(date: Date) {
    setSelectedDate(localDateKey(date));
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  }

  if (!isReady) return <main className="loading-screen" aria-busy="true"><div className="loading-mark"><BookOpen size={20} /></div><span>Opening your study desk...</span></main>;

  const heading = activeView === "overview" ? "Your study, in focus." : activeView === "calendar" ? "A month of momentum." : "Patterns worth noticing.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveView("overview")}><span className="brand-mark"><BookOpen size={19} /></span><span>daymark<span className="brand-period">.</span></span></a>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={activeView === "overview"} label="Overview" onClick={() => setActiveView("overview")}><LayoutDashboard size={18} /></NavButton>
          <NavButton active={activeView === "calendar"} label="Calendar" onClick={() => setActiveView("calendar")}><CalendarDays size={18} /></NavButton>
          <NavButton active={activeView === "insights"} label="Insights" onClick={() => setActiveView("insights")}><BarChart3 size={18} /></NavButton>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-note-icon"><Target size={17} /></div><div><p className="sidebar-note-title">Study together.</p><p className="sidebar-note-copy">Shared progress for both of you.</p></div><div className="sidebar-rule" /><div className="storage-note"><span className="status-dot" /> {selectedPerson === "all" ? "Shared view" : `${selectedPerson}`}</div></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">MY STUDY DESK <span>/</span> {activeView.toUpperCase()}</div>
          <div className="topbar-actions">
            <button type="button" className="icon-button theme-toggle" aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setIsDarkMode((value) => !value)}>{isDarkMode ? <SunMedium size={18} /> : <MoonStar size={18} />}</button>
            <div className="topbar-date"><span className="status-dot" />{formatDate(dateFromKey(today), { weekday: "long", month: "short", day: "numeric" })}</div>
          </div>
        </header>
        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow">{formatDate(dateFromKey(today), { weekday: "long", month: "long", day: "numeric" })}</div><h1>{heading}</h1><p className="page-subtitle">{activeView === "overview" ? "A clear picture of the time and effort you put in." : activeView === "calendar" ? "See your study rhythm, one day at a time." : "Use your recent habits to plan what comes next."}</p></div>
            <div className="heading-actions">
              <button className="button button-quiet" type="button" onClick={() => exportCsv(visibleEntries)}><Download size={16} /><span>Export</span></button>
              <button className="button button-primary" type="button" onClick={() => openNewEntry()}><Plus size={17} /><span>Log study</span></button>
            </div>
          </section>

          <div className="profile-controls">
            <div className="profile-list" aria-label="Study profiles">
              <button type="button" className={`profile-button ${selectedPerson === "all" ? "is-active" : ""}`} onClick={() => setSelectedPerson("all")}>Both</button>
              {people.map((person) => (
                <button key={person} type="button" className={`profile-button ${selectedPerson === person ? "is-active" : ""}`} onClick={() => setSelectedPerson(person)}>{person}</button>
              ))}
            </div>
            <button type="button" className="button button-quiet small-button" onClick={() => setPeopleManagerOpen((value) => !value)}>{peopleManagerOpen ? "Done" : "Manage names"}</button>
          </div>

          {peopleManagerOpen && (
            <div className="profile-manager-panel">
              <div className="profile-manager">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(event) => setNewPersonName(event.target.value)}
                  placeholder="Add a partner name"
                  maxLength={24}
                  aria-label="Add a new profile name"
                />
                <button type="button" className="button button-primary" onClick={addPerson}>Save name</button>
              </div>
              <div className="profile-remove-list" aria-label="Remove saved names">
                {people.map((person) => (
                  <div className="profile-remove-row" key={person}>
                    <span>{person}</span>
                    <button className="icon-button danger-hover" type="button" aria-label={`Remove ${person}`} title={`Remove ${person}`} onClick={() => removePerson(person)}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="reset-button" onClick={resetStudyData}>Reset data to zero</button>

          {activeView === "overview" && <Overview entries={visibleEntries} today={today} todayMinutes={todayMinutes} weekMinutes={weekMinutes} week={week} activeDays={activeDays} topicCount={topicCount} subjectTotals={subjectTotals} selectedDate={selectedDate} currentMonth={currentMonth} monthDays={monthDays} onChooseDate={chooseDate} onOpenCalendar={() => setActiveView("calendar")} onNewEntry={openNewEntry} onEditEntry={openEditEntry} onDeleteEntry={deleteEntry} />}
          {activeView === "calendar" && <CalendarView entries={visibleEntries} currentMonth={currentMonth} selectedDate={selectedDate} monthDays={monthDays} selectedEntries={selectedEntries} onMoveMonth={moveMonth} onChooseDate={chooseDate} onNewEntry={openNewEntry} onEditEntry={openEditEntry} onDeleteEntry={deleteEntry} />}
          {activeView === "insights" && <InsightsView entries={visibleEntries} week={week} weekdayStats={weekdayStats} strongestDay={strongestDay} slowestDay={slowestDay} weekMinutes={weekMinutes} tests={weekTests} problems={weekProblems} activeDays={activeDays} subjectTotals={subjectTotals} />}
          {formError && !isDialogOpen && <div className="save-alert" role="alert">{formError}</div>}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton active={activeView === "overview"} label="Overview" onClick={() => setActiveView("overview")}><LayoutDashboard size={19} /></NavButton>
        <NavButton active={activeView === "calendar"} label="Calendar" onClick={() => setActiveView("calendar")}><CalendarDays size={19} /></NavButton>
        <NavButton active={activeView === "insights"} label="Insights" onClick={() => setActiveView("insights")}><BarChart3 size={19} /></NavButton>
      </nav>

      {isDialogOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDialogOpen(false); }}>
        <section className="entry-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-dialog-title">
          <div className="dialog-header"><div><div className="eyebrow">STUDY JOURNAL</div><h2 id="entry-dialog-title">{editingId ? "Edit session" : "Log a study session"}</h2></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setIsDialogOpen(false)}><X size={19} /></button></div>
          <form onSubmit={saveEntry}>
            <div className="form-grid">
              <label className="field field-span"><span>Name</span><input list="person-suggestions" required value={draft.person} onChange={(event) => setDraft({ ...draft, person: event.target.value })} placeholder="You or your partner" /><datalist id="person-suggestions">{people.map((person) => <option key={person} value={person} />)}</datalist></label>
              <label className="field"><span>Date</span><input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
              <label className="field"><span>Subject</span><input list="subject-suggestions" required maxLength={60} placeholder="e.g. Biology" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /><datalist id="subject-suggestions">{SUBJECTS.map((subject) => <option key={subject} value={subject} />)}</datalist></label>
              <label className="field"><span>Topic covered</span><input required maxLength={100} placeholder="e.g. Cell division" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label>
              <div className="field field-span"><span>Study time</span><div className="duration-fields"><label><input type="number" min="0" max="24" inputMode="numeric" aria-label="Hours studied" placeholder="0" value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} /><span>hours</span></label><label><input type="number" min="0" max="59" inputMode="numeric" aria-label="Additional minutes studied" placeholder="30" value={draft.minutes} onChange={(event) => setDraft({ ...draft, minutes: event.target.value })} /><span>minutes</span></label></div></div>
              <label className="field"><span>Tests given</span><input type="number" min="0" max="999" inputMode="numeric" value={draft.tests} onChange={(event) => setDraft({ ...draft, tests: event.target.value })} /></label>
              <label className="field"><span>Problems solved</span><input type="number" min="0" max="99999" inputMode="numeric" value={draft.problems} onChange={(event) => setDraft({ ...draft, problems: event.target.value })} /></label>
              <label className="field field-span"><span>Notes <small>optional</small></span><textarea rows={3} maxLength={500} placeholder="Anything you want to remember..." value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            </div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="dialog-footer"><button className="button button-quiet" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</button><button className="button button-primary" type="submit"><Check size={16} /> Save session</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

function NavButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return <button className={`nav-item${active ? " is-active" : ""}`} type="button" onClick={onClick} aria-current={active ? "page" : undefined}>{children}<span>{label}</span></button>;
}

function StatCard({ label, value, detail, icon, accent }: { label: string; value: string; detail: string; icon: ReactNode; accent: string }) {
  return <article className="stat-card"><div className={`stat-icon stat-${accent}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></article>;
}

function Overview({ entries, today, todayMinutes, weekMinutes, week, activeDays, topicCount, subjectTotals, selectedDate, currentMonth, monthDays, onChooseDate, onOpenCalendar, onNewEntry, onEditEntry, onDeleteEntry }: {
  entries: StudyEntry[]; today: string; todayMinutes: number; weekMinutes: number; week: WeekPoint[]; activeDays: number; topicCount: number; subjectTotals: [string, number][]; selectedDate: string; currentMonth: Date; monthDays: Date[];
  onChooseDate: (date: Date) => void; onOpenCalendar: () => void; onNewEntry: (date?: string) => void; onEditEntry: (entry: StudyEntry) => void; onDeleteEntry: (entry: StudyEntry) => void;
}) {
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 4);
  const maxBar = Math.max(...week.map((day) => day.minutes), 60);
  const maxSubject = Math.max(...subjectTotals.map(([, minutes]) => minutes), 1);
  return <>
    <section className="stat-grid" aria-label="Study summary">
      <StatCard label="STUDIED TODAY" value={formatMinutes(todayMinutes)} detail={todayMinutes ? "Time spent learning today" : "Your next focused session starts here"} icon={<BookOpen size={17} />} accent="green" />
      <StatCard label="LAST 7 DAYS" value={formatMinutes(weekMinutes)} detail={`${activeDays} of 7 days with study logged`} icon={<Flame size={17} />} accent="orange" />
      <StatCard label="TOPICS COVERED" value={String(topicCount)} detail="Across your last 7 days" icon={<Target size={17} />} accent="blue" />
      <StatCard label="SESSIONS LOGGED" value={String(entries.length)} detail="All-time study sessions" icon={<CalendarDays size={17} />} accent="gold" />
    </section>
    <section className="dashboard-grid">
      <article className="panel weekly-panel"><div className="panel-heading"><div><p className="panel-kicker">YOUR RHYTHM</p><h2>Study time</h2></div><span className="period-tag">Last 7 days</span></div>
        {weekMinutes ? <div className="chart-area" role="img" aria-label={`Study time over the last seven days, ${formatMinutes(weekMinutes)} total`}><div className="chart-guides"><span>{formatMinutes(maxBar)}</span><span>{formatMinutes(Math.round(maxBar / 2))}</span><span>0m</span></div><div className="bar-chart">{week.map((day) => <div className="bar-column" key={day.key}><div className="bar-value">{day.minutes ? formatMinutes(day.minutes) : ""}</div><div className="bar-track"><div className={`bar-fill${day.key === today ? " is-today" : ""}`} style={{ height: `${day.minutes ? Math.max(5, day.minutes / maxBar * 100) : 0}%` }} /></div><span className={`bar-day${day.key === today ? " is-today" : ""}`}>{day.label}<small>{day.dateLabel}</small></span></div>)}</div></div> : <div className="chart-empty"><div className="empty-illustration"><BarChart3 size={24} /></div><p>Your study time will take shape here.</p><button type="button" className="text-action" onClick={() => onNewEntry(today)}>Log your first session <ChevronRight size={15} /></button></div>}
      </article>
      <article className="panel mini-calendar-panel"><div className="panel-heading"><div><p className="panel-kicker">YOUR DAYS</p><h2>{formatDate(currentMonth, { month: "long", year: "numeric" })}</h2></div><button className="text-action" type="button" onClick={onOpenCalendar}>Open calendar <ChevronRight size={14} /></button></div><MiniCalendar entries={entries} days={monthDays} month={currentMonth} selectedDate={selectedDate} onChooseDate={onChooseDate} /><div className="calendar-legend"><span><i className="legend-dot legend-light" />Logged time</span><span><i className="legend-dot legend-today" />Today</span></div></article>
    </section>
    <section className="lower-grid">
      <article className="panel subject-panel"><div className="panel-heading"><div><p className="panel-kicker">WHERE TIME WENT</p><h2>Subject focus</h2></div><span className="period-tag">Last 7 days</span></div>{subjectTotals.length ? <SubjectList totals={subjectTotals.slice(0, 5)} max={maxSubject} /> : <div className="small-empty">Log sessions in different subjects to see your focus split.</div>}</article>
      <article className="panel recent-panel"><div className="panel-heading"><div><p className="panel-kicker">RECENT ACTIVITY</p><h2>Study log</h2></div><button className="text-action" type="button" onClick={onOpenCalendar}>View calendar <ChevronRight size={14} /></button></div>{recent.length ? <div className="recent-list">{recent.map((entry) => <EntryRow key={entry.id} entry={entry} onEdit={onEditEntry} onDelete={onDeleteEntry} />)}</div> : <div className="small-empty">Your saved sessions will appear here.</div>}</article>
    </section>
  </>;
}

function SubjectList({ totals, max }: { totals: [string, number][]; max: number }) {
  return <div className="subject-list">{totals.map(([subject, minutes], index) => <div className="subject-row" key={subject}><div className="subject-row-heading"><span><i className={`subject-dot subject-color-${index % 5}`} />{subject}</span><strong>{formatMinutes(minutes)}</strong></div><div className="subject-track"><div className={`subject-fill subject-color-${index % 5}`} style={{ width: `${Math.max(3, minutes / max * 100)}%` }} /></div></div>)}</div>;
}

function MiniCalendar({ entries, days, month, selectedDate, onChooseDate }: { entries: StudyEntry[]; days: Date[]; month: Date; selectedDate: string; onChooseDate: (date: Date) => void }) {
  return <div className="mini-calendar">{WEEKDAYS.map((day) => <span className="mini-weekday" key={day}>{day.slice(0, 1)}</span>)}{days.map((date) => {
    const key = localDateKey(date);
    const inMonth = date.getMonth() === month.getMonth();
    const minutes = minutesForDate(entries, key);
    return <button type="button" key={key} className={`mini-day${inMonth ? "" : " outside-month"}${key === selectedDate ? " selected" : ""}${key === localDateKey() ? " today" : ""}${minutes ? " has-log" : ""}`} aria-label={`${formatDate(date, { month: "long", day: "numeric", year: "numeric" })}${minutes ? `, ${formatMinutes(minutes)} studied` : ""}`} onClick={() => onChooseDate(date)}><span>{date.getDate()}</span>{minutes > 0 && <i />}</button>;
  })}</div>;
}

function CalendarView({ entries, currentMonth, selectedDate, monthDays, selectedEntries, onMoveMonth, onChooseDate, onNewEntry, onEditEntry, onDeleteEntry }: {
  entries: StudyEntry[]; currentMonth: Date; selectedDate: string; monthDays: Date[]; selectedEntries: StudyEntry[]; onMoveMonth: (amount: number) => void; onChooseDate: (date: Date) => void; onNewEntry: (date?: string) => void; onEditEntry: (entry: StudyEntry) => void; onDeleteEntry: (entry: StudyEntry) => void;
}) {
  const selected = selectedDate ? dateFromKey(selectedDate) : currentMonth;
  return <section className="calendar-layout">
    <article className="panel calendar-panel"><div className="calendar-toolbar"><div><p className="panel-kicker">STUDY CALENDAR</p><h2>{formatDate(currentMonth, { month: "long", year: "numeric" })}</h2></div><div className="month-controls"><button className="icon-button" type="button" aria-label="Previous month" onClick={() => onMoveMonth(-1)}><ChevronLeft size={18} /></button><button className="button button-quiet today-button" type="button" onClick={() => onChooseDate(new Date())}>Today</button><button className="icon-button" type="button" aria-label="Next month" onClick={() => onMoveMonth(1)}><ChevronRight size={18} /></button></div></div>
      <div className="full-calendar">{WEEKDAYS.map((day) => <div className="full-weekday" key={day}>{day}</div>)}{monthDays.map((date) => {
        const key = localDateKey(date);
        const minutes = minutesForDate(entries, key);
        const inMonth = date.getMonth() === currentMonth.getMonth();
        const dayEntries = entriesForDate(entries, key);
        return <button type="button" className={`full-day${inMonth ? "" : " outside-month"}${key === selectedDate ? " selected" : ""}${key === localDateKey() ? " today" : ""}${minutes ? " has-log" : ""}`} key={key} onClick={() => onChooseDate(date)} aria-pressed={key === selectedDate}><span className="full-day-number">{date.getDate()}</span>{minutes > 0 && <span className="day-total">{formatMinutes(minutes)}</span>}{minutes > 0 && <span className="day-log-count">{dayEntries.length} {dayEntries.length === 1 ? "session" : "sessions"}</span>}</button>;
      })}</div><div className="calendar-legend full-legend"><span><i className="legend-dot legend-light" />Study logged</span><span><i className="legend-dot legend-today" />Today</span></div>
    </article>
    <aside className="panel day-detail-panel"><div className="day-detail-heading"><div><p className="panel-kicker">SELECTED DAY</p><h2>{formatDate(selected, { weekday: "long", day: "numeric" })}</h2><p>{formatDate(selected, { month: "long", year: "numeric" })}</p></div><span className="day-detail-icon"><CalendarDays size={19} /></span></div><div className="day-total-block"><span>Total study time</span><strong>{formatMinutes(sumMinutes(selectedEntries))}</strong></div><div className="day-detail-list">{selectedEntries.length ? selectedEntries.map((entry) => <EntryRow key={entry.id} entry={entry} onEdit={onEditEntry} onDelete={onDeleteEntry} />) : <div className="small-empty">No sessions logged for this day.</div>}</div><button className="button button-primary add-day-button" type="button" onClick={() => onNewEntry(selectedDate)}><Plus size={16} /> Add session</button></aside>
  </section>;
}

function InsightsView({ entries, week, weekdayStats, strongestDay, slowestDay, weekMinutes, tests, problems, activeDays, subjectTotals }: {
  entries: StudyEntry[]; week: WeekPoint[]; weekdayStats: { label: string; average: number }[]; strongestDay: { label: string; average: number }; slowestDay: { label: string; average: number }; weekMinutes: number; tests: number; problems: number; activeDays: number; subjectTotals: [string, number][];
}) {
  const averagesExist = weekdayStats.some((day) => day.average > 0);
  const maxAverage = Math.max(...weekdayStats.map((day) => day.average), 1);
  const maxSubject = Math.max(...subjectTotals.map(([, minutes]) => minutes), 1);
  const maxWeek = Math.max(...week.map((day) => day.minutes), 1);
  const totalTime = sumMinutes(entries);
  const allTests = entries.reduce((total, entry) => total + entry.tests, 0);
  const allProblems = entries.reduce((total, entry) => total + entry.problems, 0);
  return <>
    <section className="insight-callouts">
      <InsightCard tone="strong" icon={<Flame size={19} />} label="STRONGEST WEEKDAY" period="Past 4 weeks" value={averagesExist ? strongestDay.label : "-"} detail={averagesExist ? `${formatMinutes(Math.round(strongestDay.average))} average per ${strongestDay.label}` : "Log sessions to reveal your pattern."} />
      <InsightCard tone="light" icon={<Target size={19} />} label="QUIETEST WEEKDAY" period="Past 4 weeks" value={averagesExist ? slowestDay.label : "-"} detail={averagesExist ? `${formatMinutes(Math.round(slowestDay.average))} average per ${slowestDay.label}` : "Your lower-activity days will show here."} />
      <InsightCard tone="warm" icon={<BookOpen size={19} />} label="ALL-TIME STUDY TIME" value={formatMinutes(totalTime)} detail={`${entries.length} sessions recorded so far`} />
    </section>
    <section className="dashboard-grid insight-grid">
      <article className="panel weekday-panel"><div className="panel-heading"><div><p className="panel-kicker">WEEKDAY AVERAGES</p><h2>When you focus</h2></div><span className="period-tag">Past 28 days</span></div><p className="panel-description">Average logged study time for each weekday, including days with no sessions.</p><div className="weekday-chart">{weekdayStats.map((day) => <div className="weekday-bar-column" key={day.label}><span>{day.average ? formatMinutes(Math.round(day.average)) : "-"}</span><div className="weekday-bar-track"><div style={{ height: `${day.average ? Math.max(4, day.average / maxAverage * 100) : 0}%` }} /></div><small>{day.label}</small></div>)}</div>{!averagesExist && <div className="chart-empty insight-empty">Log a few sessions to compare your weekdays.</div>}</article>
      <article className="panel summary-panel"><div className="panel-heading"><div><p className="panel-kicker">EFFORT, NOT JUST HOURS</p><h2>Practice summary</h2></div></div><div className="practice-list"><PracticeStat label="Problems solved" value={allProblems} note={`${problems} in the past 7 days`} /><PracticeStat label="Tests given" value={allTests} note={`${tests} in the past 7 days`} /><PracticeStat label="Study days" value={activeDays} note="Days with a session, past 7 days" /></div></article>
    </section>
    <section className="lower-grid insight-lower"><article className="panel subject-panel"><div className="panel-heading"><div><p className="panel-kicker">RECENT FOCUS</p><h2>Time by subject</h2></div><span className="period-tag">Last 7 days</span></div>{subjectTotals.length ? <SubjectList totals={subjectTotals} max={maxSubject} /> : <div className="small-empty">Subject comparisons appear after you log study time.</div>}</article>
      <article className="panel week-summary-panel"><div className="panel-heading"><div><p className="panel-kicker">LAST 7 DAYS</p><h2>At a glance</h2></div></div><div className="week-summary-total">{formatMinutes(weekMinutes)}<span> recorded</span></div><div className="week-mini-bars" aria-label="Daily study minutes">{week.map((day) => <div key={day.key} title={`${day.label}: ${formatMinutes(day.minutes)}`}><span style={{ height: `${day.minutes ? Math.max(6, day.minutes / maxWeek * 100) : 0}%` }} /></div>)}</div><div className="week-mini-labels">{week.map((day) => <span key={day.key}>{day.label.slice(0, 1)}</span>)}</div></article>
    </section>
  </>;
}

function InsightCard({ tone, icon, label, period, value, detail }: { tone: string; icon: ReactNode; label: string; period?: string; value: string; detail: string }) {
  return <article className={`insight-card insight-${tone}`}><div className="insight-icon">{icon}</div><div><span>{label}{period && <small>{period}</small>}</span><strong>{value}</strong><p>{detail}</p></div></article>;
}

function PracticeStat({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="practice-row"><div><strong>{value}</strong><span>{label}</span></div><small>{note}</small></div>;
}

function EntryRow({ entry, onEdit, onDelete }: { entry: StudyEntry; onEdit: (entry: StudyEntry) => void; onDelete: (entry: StudyEntry) => void }) {
  return <article className="entry-row"><span className="entry-subject-mark"><BookOpen size={16} /></span><div className="entry-main"><div className="entry-title-line"><strong>{entry.subject}</strong><span>{formatMinutes(entry.minutes)}</span></div><div className="entry-topic">{entry.topic}</div><div className="entry-meta"><span>{formatDate(dateFromKey(entry.date), { month: "short", day: "numeric" })}</span>{entry.tests > 0 && <span>{entry.tests} {entry.tests === 1 ? "test" : "tests"}</span>}{entry.problems > 0 && <span>{entry.problems} {entry.problems === 1 ? "problem" : "problems"}</span>}<span>{entry.person}</span></div>{entry.notes && <p className="entry-note">{entry.notes}</p>}</div><div className="entry-actions"><button className="icon-button" type="button" aria-label={`Edit ${entry.subject} session`} onClick={() => onEdit(entry)}><Pencil size={15} /></button><button className="icon-button danger-hover" type="button" aria-label={`Delete ${entry.subject} session`} onClick={() => onDelete(entry)}><Trash2 size={15} /></button></div></article>;
}
