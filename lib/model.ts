export type Status = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  projectId: string | null;
  milestoneId: string | null;
  dueDate: string;
  estimatedMinutes: number;
  actualMinutes: number;
  createdAt: string;
  completedAt: string | null;
  tags: string[];
  order: number;
};
export type Project = {
  id: string;
  name: string;
  description: string;
  status: "Planning" | "Active" | "Paused" | "Completed" | "Archived";
  priority: Priority;
  dueDate: string;
  goalId: string | null;
  skillIds: string[];
  notes: string;
  createdAt: string;
};
export type Milestone = { id: string; projectId: string; title: string; dueDate: string; done: boolean };
export type Reminder = {
  id: string;
  title: string;
  at: string;
  recurrence: "None" | "Daily" | "Weekly" | "Monthly";
  taskId: string | null;
  projectId: string | null;
  done: boolean;
};
export type Skill = {
  id: string;
  name: string;
  category: string;
  level: number;
  targetLevel: number;
  description: string;
  createdAt: string;
  history: { date: string; level: number }[];
};
export type Learning = {
  id: string;
  topic: string;
  skillId: string | null;
  duration: number;
  date: string;
  notes: string;
  source: string;
};
export type Goal = {
  id: string;
  title: string;
  description: string;
  category: string;
  targetDate: string;
  progress: number;
  status: "Active" | "Completed" | "Paused";
  projectIds: string[];
  skillIds: string[];
};
export type TimeEntry = {
  id: string;
  taskId: string | null;
  projectId: string | null;
  startTime: string;
  endTime: string;
  duration: number;
  type: "FOCUS" | "LEARNING" | "MEETING" | "OTHER";
};
export type Focus = { taskId: string; startedAt: string; elapsedMinutes: number; paused: boolean } | null;
export type State = {
  tasks: Task[];
  projects: Project[];
  milestones: Milestone[];
  reminders: Reminder[];
  skills: Skill[];
  learning: Learning[];
  goals: Goal[];
  timeEntries: TimeEntry[];
  focus: Focus;
  name: string;
  language?: "zh" | "en";
  /** Set when the user dismisses the getting-started guide. */
  guideHidden?: boolean;
};

export const uid = () => crypto.randomUUID();

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day as `YYYY-MM-DD`, in the viewer's own time zone. */
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

/** Parses ISO timestamps and date-only strings; date-only values are read as local noon so they never shift a day. */
export const toDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : new Date(value);

/** ISO timestamp → value for an `<input type="datetime-local">`. */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** `<input type="datetime-local">` value → ISO timestamp. */
export const fromLocalInput = (value: string) => new Date(value).toISOString();

/** Monday 00:00 of the current local week. */
export const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
};

export const progress = (tasks: Task[]) =>
  tasks.length ? Math.round((tasks.filter((t) => t.status === "DONE").length / tasks.length) * 100) : 0;

export function seed(language: "zh" | "en" = "zh"): State {
  return {
    tasks: [],
    projects: [],
    milestones: [],
    reminders: [],
    skills: [],
    learning: [],
    goals: [],
    timeEntries: [],
    focus: null,
    name: "",
    language,
  };
}
