"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  CalendarDays,
  TrendingUp,
  Bell,
  Search,
  Plus,
  Play,
  Pause,
  Check,
  Clock3,
  ArrowUpRight,
  BookOpen,
  BarChart3,
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Archive,
  ArchiveRestore,
  Download,
  Upload,
  MonitorDown,
  Share,
  Menu,
  X,
  CircleCheck,
  Circle,
  RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  dateKey,
  addDays,
  progress,
  uid,
  toDate,
  toLocalInput,
  fromLocalInput,
  weekStart,
  type State,
  type Task,
  type Project,
  type Reminder,
  type Learning,
  type Skill,
  type Goal,
  type Milestone,
  type TimeEntry,
} from "@/lib/model";
import { translate, durationText, type Language } from "@/lib/i18n";
import { loadState, saveState, freshState, isState } from "@/lib/storage";
import PageDeck from "@/components/page-deck";

type Kind = "task" | "project" | "reminder" | "learning" | "skill" | "goal" | "milestone" | "time";
type Modal = { kind: Kind; id?: string; projectId?: string; date?: string };
type Toast = { id: number; message: string; action?: { label: string; run: () => void } };
type Option = { value: string; label: string };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type FieldOptions = {
  type?: string;
  value?: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
};

const groups = [
  ["", "Dashboard", "/dashboard", LayoutDashboard],
  ["WORK", "Projects", "/projects", FolderKanban],
  ["", "Tasks", "/tasks", ListTodo],
  ["", "Calendar", "/calendar", CalendarDays],
  ["GROWTH", "Skills", "/growth", TrendingUp],
  ["", "Learning", "/learning", BookOpen],
  ["", "Goals", "/goals", Target],
  ["REVIEW", "Weekly Review", "/review", Clock3],
  ["", "Analytics", "/analytics", BarChart3],
  ["SYSTEM", "Reminders", "/reminders", Bell],
  ["", "Settings", "/settings", Settings],
] as const;
const mobileNav = [groups[0], groups[2], groups[1], groups[3], groups[4]];
const collections = [
  "tasks",
  "projects",
  "milestones",
  "reminders",
  "skills",
  "learning",
  "goals",
  "timeEntries",
] as const;

const locale = (language: Language) => (language === "zh" ? "zh-CN" : "en-US");
const fmt = (s: string, options?: Intl.DateTimeFormatOptions, language: Language = "en") =>
  new Intl.DateTimeFormat(locale(language), { month: "short", day: "numeric", ...options }).format(toDate(s));
const showTime = (s: string, language: Language = "en") =>
  new Intl.DateTimeFormat(locale(language), { hour: "numeric", minute: "2-digit" }).format(toDate(s));
const dayOf = (s: string) => dateKey(toDate(s));
const baseCap = (s: string) => s[0] + s.slice(1).toLowerCase().replaceAll("_", " ");
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
/** A sensible default deadline for quick-added tasks: today 18:00, or end of day if that has passed. */
const defaultDue = () => {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  if (d < new Date()) d.setHours(23, 59, 0, 0);
  return d.toISOString();
};
const newTask = (
  title: string,
  order: number,
  projectId: string | null = null,
  dueDate = defaultDue(),
): Task => ({
  id: uid(),
  title,
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  projectId,
  milestoneId: null,
  dueDate,
  estimatedMinutes: 30,
  actualMinutes: 0,
  createdAt: new Date().toISOString(),
  completedAt: null,
  tags: [],
  order,
});
/** Puts back any records from `before` that are missing now (used by undo after a delete). */
const restoreMissing = (s: State, before: State) => {
  for (const key of collections) {
    const current = s[key] as { id: string }[];
    const ids = new Set(current.map((x) => x.id));
    (s as Record<string, unknown>)[key] = [
      ...current,
      ...(before[key] as { id: string }[]).filter((x) => !ids.has(x.id)),
    ];
  }
};

const LanguageContext = createContext<Language>("zh");
function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  const language = useContext(LanguageContext);
  return (
    <div className="empty">
      <strong>{translate(language, title)}</strong>
      <p>{translate(language, detail)}</p>
      {action}
    </div>
  );
}
function Bar({ value }: { value: number }) {
  return (
    <div className="bar">
      <i style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
    </div>
  );
}

export default function PersonalOS() {
  const [data, setData] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const language: Language = data?.language || "zh";
  const tr = (text: string) => translate(language, text);
  const duration = (value: number) => durationText(language, value);
  const cap = (value: string) => tr(baseCap(value));
  const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) => fmt(value, options, language);
  const timeOf = (value: string) => showTime(value, language);
  const kindLabel = (kind: Kind) =>
    language === "zh"
      ? tr(kind)
      : kind === "time"
        ? "time entry"
        : kind === "learning"
          ? "learning session"
          : kind;
  const [path, setPath] = useState("/dashboard"),
    [modal, setModal] = useState<Modal | null>(null),
    [search, setSearch] = useState(false),
    [menu, setMenu] = useState(false);
  const [view, setView] = useState<"Month" | "Week" | "Day">("Week"),
    [selectedDate, setSelectedDate] = useState(dateKey()),
    [tick, setTick] = useState(Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const latest = useRef<State | null>(null),
    queue = useRef(Promise.resolve()),
    toastId = useRef(0);

  useEffect(() => {
    const update = () => setPath(location.pathname === "/" ? "/dashboard" : location.pathname);
    update();
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    try {
      const x = loadState();
      latest.current = x;
      setData(x);
      // App shortcuts (long-press the installed icon) open e.g. /tasks?new=task.
      const kind = new URLSearchParams(location.search).get("new");
      if (kind && ["task", "project", "reminder", "learning", "goal", "skill"].includes(kind)) {
        setModal({ kind: kind as Kind });
        history.replaceState({}, "", location.pathname);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, []);
  // The focus timer only needs a clock while it is running.
  const focusRunning = !!data?.focus && !data.focus.paused;
  useEffect(() => {
    if (!focusRunning) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [focusRunning]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((open) => !open);
        return;
      }
      if (e.key === "Escape") setMenu(false);
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(e.target) ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        setSearch(true);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setModal({ kind: "task" });
      }
    };
    addEventListener("keydown", fn);
    return () => removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);
  // Installable app (PWA): offline support plus the browser's install prompt.
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null),
    [installed, setInstalled] = useState(false),
    [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(console.error);
    setInstalled(
      matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    addEventListener("beforeinstallprompt", onPrompt);
    addEventListener("appinstalled", onInstalled);
    return () => {
      removeEventListener("beforeinstallprompt", onPrompt);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const navigate = (to: string) => {
    if (to !== location.pathname) history.pushState({}, "", to);
    setPath(to);
    setMenu(false);
    setSearch(false);
  };
  const notify = (message: string, action?: Toast["action"]) => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-2), { id, message, action }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), action ? 6000 : 2600);
  };
  const dismissToast = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));
  const save = (next: State) => {
    latest.current = next;
    setData(next);
    setSaving(true);
    queue.current = queue.current
      .catch(() => {})
      .then(() => {
        saveState(next);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not save"))
      .finally(() => setSaving(false));
  };
  const change = (fn: (s: State) => void) => {
    if (!latest.current) return;
    const next = structuredClone(latest.current);
    fn(next);
    save(next);
  };
  const setLanguage = (next: Language) =>
    change((s) => {
      s.language = next;
    });

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "get_dashboard_summary",
          title: "Get dashboard summary",
          description: "Read today's tasks, current focus, and active project count.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: () => {
            const s = latest.current;
            if (!s) throw Error("Workspace is loading");
            const today = dateKey();
            const tasks = s.tasks.filter((t) => dayOf(t.dueDate) === today && t.status !== "CANCELLED");
            return {
              date: today,
              tasksToday: tasks.length,
              completed: tasks.filter((t) => t.status === "DONE").length,
              currentFocusTaskId: s.focus?.taskId || null,
              activeProjects: s.projects.filter((p) => p.status === "Active").length,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(console.error);
    Promise.resolve(
      context.registerTool(
        {
          name: "create_task",
          title: "Create task",
          description: "Create a task in Personal OS and save it to the workspace.",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1 },
              projectId: { type: "string" },
              dueDate: { type: "string", description: "ISO date and time" },
            },
            required: ["title"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const x = input as { title?: string; projectId?: string; dueDate?: string };
            if (!x || typeof x.title !== "string" || !x.title.trim()) throw Error("A task title is required");
            const s = latest.current;
            if (!s) throw Error("Workspace is loading");
            if (x.projectId && !s.projects.some((p) => p.id === x.projectId))
              throw Error("Project not found");
            const due = x.dueDate ? new Date(x.dueDate) : new Date(defaultDue());
            if (Number.isNaN(due.getTime())) throw Error("Invalid due date");
            const task = newTask(x.title.trim(), s.tasks.length + 1, x.projectId || null, due.toISOString());
            change((state) => state.tasks.push(task));
            await queue.current;
            return { id: task.id, title: task.title, saved: true };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(console.error);
    return () => lifecycle.abort();
  }, []);

  const retry = () => {
    if (latest.current) save(latest.current);
  };
  const proj = (id: string | null) => data?.projects.find((p) => p.id === id);
  const skill = (id: string | null) => data?.skills.find((s) => s.id === id);
  const task = (id: string) => data?.tasks.find((t) => t.id === id);
  const taskProgress = (p: Project) =>
    progress(data?.tasks.filter((t) => t.projectId === p.id && t.status !== "CANCELLED") || []);
  const today = dateKey(),
    nowIso = new Date().toISOString(),
    todayTasks =
      data?.tasks
        .filter((t) => dayOf(t.dueDate) === today && t.status !== "CANCELLED")
        .sort((a, b) => a.order - b.order) || [];
  const activeProjects = data?.projects.filter((p) => p.status === "Active") || [];
  const current = data?.focus
    ? task(data.focus.taskId)
    : data?.tasks.find((t) => t.status === "IN_PROGRESS") || todayTasks.find((t) => t.status === "TODO");
  const focusSeconds = data?.focus
    ? Math.floor(
        data.focus.elapsedMinutes * 60 +
          (data.focus.paused ? 0 : Math.max(0, (tick - new Date(data.focus.startedAt).getTime()) / 1000)),
      )
    : 0;
  const focusLabel =
    String(Math.floor(focusSeconds / 3600)).padStart(2, "0") +
    ":" +
    String(Math.floor((focusSeconds % 3600) / 60)).padStart(2, "0") +
    ":" +
    String(focusSeconds % 60).padStart(2, "0");

  const finishFocusIn = (s: State) => {
    if (!s.focus) return;
    const f = s.focus;
    const end = new Date();
    const minutes = Math.max(
      1,
      Math.ceil(
        f.elapsedMinutes + (f.paused ? 0 : (end.getTime() - new Date(f.startedAt).getTime()) / 60000),
      ),
    );
    const t = s.tasks.find((t) => t.id === f.taskId);
    s.timeEntries.push({
      id: uid(),
      taskId: f.taskId,
      projectId: t?.projectId || null,
      startTime: new Date(end.getTime() - minutes * 60000).toISOString(),
      endTime: end.toISOString(),
      duration: minutes,
      type: "FOCUS",
    });
    if (t) t.actualMinutes += minutes;
    s.focus = null;
  };
  const startFocus = (id: string) => {
    change((s) => {
      if (s.focus && s.focus.taskId !== id) finishFocusIn(s);
      s.focus = { taskId: id, startedAt: new Date().toISOString(), elapsedMinutes: 0, paused: false };
      const t = s.tasks.find((t) => t.id === id);
      if (t) t.status = "IN_PROGRESS";
    });
    notify(
      tr("Focus started"),
      path === "/dashboard" ? undefined : { label: tr("Dashboard"), run: () => navigate("/dashboard") },
    );
  };
  const pauseFocus = () =>
    change((s) => {
      if (!s.focus) return;
      if (s.focus.paused) {
        s.focus.startedAt = new Date().toISOString();
        s.focus.paused = false;
      } else {
        s.focus.elapsedMinutes += (Date.now() - new Date(s.focus.startedAt).getTime()) / 60000;
        s.focus.paused = true;
      }
    });
  const endFocus = (complete = false) => {
    change((s) => {
      const id = s.focus?.taskId;
      finishFocusIn(s);
      if (complete && id) {
        const t = s.tasks.find((t) => t.id === id);
        if (t) {
          t.status = "DONE";
          t.completedAt = new Date().toISOString();
        }
      }
    });
    notify(tr(complete ? "Task completed" : "Focus session saved"));
  };
  const toggleTask = (id: string) =>
    change((s) => {
      const t = s.tasks.find((t) => t.id === id);
      if (t) {
        t.status = t.status === "DONE" ? "TODO" : "DONE";
        t.completedAt = t.status === "DONE" ? new Date().toISOString() : null;
        if (s.focus?.taskId === id && t.status === "DONE") finishFocusIn(s);
      }
    });
  /** Deletes immediately and offers Undo instead of asking for confirmation first. */
  const remove = (kind: Kind, id: string) => {
    const before = latest.current;
    if (!before) return;
    change((s) => {
      if (kind === "task") {
        s.tasks = s.tasks.filter((t) => t.id !== id);
        if (s.focus?.taskId === id) s.focus = null;
      }
      if (kind === "project") {
        s.projects = s.projects.filter((p) => p.id !== id);
        s.tasks = s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t));
        s.milestones = s.milestones.filter((m) => m.projectId !== id);
      }
      if (kind === "reminder") s.reminders = s.reminders.filter((x) => x.id !== id);
      if (kind === "learning") {
        s.learning = s.learning.filter((x) => x.id !== id);
        s.timeEntries = s.timeEntries.filter((x) => x.id !== "learning-" + id);
      }
      if (kind === "skill") s.skills = s.skills.filter((x) => x.id !== id);
      if (kind === "goal") s.goals = s.goals.filter((x) => x.id !== id);
      if (kind === "milestone") s.milestones = s.milestones.filter((x) => x.id !== id);
      if (kind === "time") s.timeEntries = s.timeEntries.filter((x) => x.id !== id);
    });
    setModal(null);
    notify(tr("Deleted"), {
      label: tr("Undo"),
      run: () =>
        change((s) => {
          restoreMissing(s, before);
          if (kind === "project")
            for (const t of s.tasks)
              if (t.projectId === null && before.tasks.find((o) => o.id === t.id)?.projectId === id)
                t.projectId = id;
          if (kind === "task" && before.focus?.taskId === id && !s.focus) s.focus = before.focus;
        }),
    });
  };
  const openNew = (kind: Kind, extra?: { projectId?: string; date?: string }) => {
    setModal({ kind, ...extra });
    setSearch(false);
  };
  const openRecord = (kind: Kind, id: string) => {
    // Learning sessions create a linked time entry; edit the session itself so both stay in sync.
    if (kind === "time" && id.startsWith("learning-")) setModal({ kind: "learning", id: id.slice(9) });
    else setModal({ kind, id });
  };
  const quickAdd = (e: React.FormEvent<HTMLFormElement>, projectId: string | null = null) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("title") as HTMLInputElement;
    const title = input.value.trim();
    if (!title) return;
    change((s) => s.tasks.push(newTask(title, s.tasks.length + 1, projectId)));
    input.value = "";
    notify(tr("Added"));
  };
  const dueLabel = (iso: string) => {
    const d = dayOf(iso);
    if (d === today) return timeOf(iso);
    if (d === addDays(1)) return tr("Tomorrow") + " " + timeOf(iso);
    return formatDate(iso);
  };

  const taskRow = (t: Task) => {
    const focused = data?.focus?.taskId === t.id;
    const late = t.status !== "DONE" && t.dueDate < nowIso;
    return (
      <div className={"task interactive" + (focused ? " is-focused" : "")} key={t.id}>
        <Checkbox
          checked={t.status === "DONE"}
          onCheckedChange={() => toggleTask(t.id)}
          aria-label={tr("Complete") + " " + t.title}
        />
        <button className="row-title" onClick={() => setModal({ kind: "task", id: t.id })}>
          <strong className={t.status === "DONE" ? "crossed" : ""}>{t.title}</strong>
          <span>{proj(t.projectId)?.name || tr("No project")}</span>
        </button>
        <span className={"status " + t.status.toLowerCase()}>{cap(t.status)}</span>
        <time className={late ? "overdue" : ""}>{dueLabel(t.dueDate)}</time>
        {t.status !== "DONE" && (
          <button
            className="row-icon"
            onClick={() => (focused ? pauseFocus() : startFocus(t.id))}
            aria-label={(focused ? tr("Pause") : tr("Focus on")) + " " + t.title}
            title={focused ? tr("Pause") : tr("Start focus")}
          >
            {focused && !data?.focus?.paused ? <Pause size={14} /> : <Play size={14} />}
          </button>
        )}
      </div>
    );
  };
  const quickAddForm = (projectId: string | null = null) => (
    <form className="quick-add" onSubmit={(e) => quickAdd(e, projectId)}>
      <Plus size={15} aria-hidden="true" />
      <input name="title" placeholder={tr("Quick add a task, press Enter")} aria-label={tr("Add task")} />
    </form>
  );
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const navButtons = (
    <>
      {groups.map(([heading, name, href, Icon]) => (
        <div key={href}>
          {heading && <div className="navtitle">{tr(heading)}</div>}
          <button
            className={isActive(href) ? "active" : ""}
            aria-current={isActive(href) ? "page" : undefined}
            onClick={() => navigate(href)}
            title={tr(name)}
          >
            <Icon size={17} />
            {tr(name)}
          </button>
        </div>
      ))}
    </>
  );
  /** Page heading. Pass `raw` when the title/subtitle is user content that must not be translated. */
  const heading = (
    eyebrow: string,
    title: string,
    subtitle: string,
    button?: React.ReactNode,
    raw = false,
  ) => (
    <div className="heading">
      <div>
        <small>{raw ? eyebrow : tr(eyebrow)}</small>
        <h1>{raw ? title : tr(title)}</h1>
        {subtitle && <p>{raw ? subtitle : tr(subtitle)}</p>}
      </div>
      {button}
    </div>
  );
  const metric = (label: string, value: string, hint: string) => (
    <div className="card metric" key={label}>
      <label>{tr(label)}</label>
      <strong>{value}</strong>
      <small>{tr(hint)}</small>
    </div>
  );
  const panel = (eyebrow: string, title: string, action: React.ReactNode, body: React.ReactNode) => (
    <section key={eyebrow + "-" + title} className="card">
      <div className="sectionhead">
        <div>
          <small>{tr(eyebrow)}</small>
          <h2>{tr(title)}</h2>
        </div>
        {action}
      </div>
      {body}
    </section>
  );
  const link = (label: string, to: string) => (
    <button onClick={() => navigate(to)}>
      {tr(label)} <ArrowUpRight size={14} />
    </button>
  );
  const addButton = (label: string, onClick: () => void, primary = true) => (
    <button className={primary ? "primary" : "secondary"} onClick={onClick}>
      <Plus size={16} /> {tr(label)}
    </button>
  );

  const onboarding = () => {
    if (!data || data.guideHidden) return null;
    const steps = [
      { done: !!data.name.trim(), label: "Add your name", run: () => navigate("/settings") },
      { done: data.projects.length > 0, label: "Create your first project", run: () => openNew("project") },
      { done: data.tasks.length > 0, label: "Add your first task", run: () => openNew("task") },
    ];
    if (steps.every((s) => s.done)) return null;
    return (
      <section className="card onboarding" key="onboarding">
        <div>
          <small>{tr("GET STARTED")}</small>
          <h2>{tr("Set up your Personal OS")}</h2>
          <p>{tr("Everything starts empty. Three small steps and your workspace is ready.")}</p>
        </div>
        <div className="onboarding-steps">
          {steps.map((step, i) => (
            <button
              key={step.label}
              className={step.done ? "done" : ""}
              onClick={step.run}
              disabled={step.done}
            >
              {step.done ? <CircleCheck size={17} /> : <Circle size={17} />}
              <span>
                <em>{i + 1}</em>
                {tr(step.label)}
              </span>
              {!step.done && <ChevronRight size={15} />}
            </button>
          ))}
        </div>
        <button
          className="onboarding-close"
          onClick={() =>
            change((s) => {
              s.guideHidden = true;
            })
          }
          aria-label={tr("Hide guide")}
          title={tr("Hide guide")}
        >
          <X size={16} />
        </button>
      </section>
    );
  };

  const dashboard = () => {
    const done = todayTasks.filter((t) => t.status === "DONE").length;
    const hour = new Date().getHours();
    const greeting = tr(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
    const name = data!.name.trim();
    const agenda = [
      ...todayTasks
        .filter((t) => t.status !== "DONE")
        .map((t) => ({
          id: t.id,
          kind: "task" as Kind,
          title: t.title,
          at: t.dueDate,
          sub: proj(t.projectId)?.name,
        })),
      ...data!.reminders
        .filter((r) => !r.done && dayOf(r.at) === today)
        .map((r) => ({ id: r.id, kind: "reminder" as Kind, title: r.title, at: r.at, sub: undefined })),
    ]
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 4);
    const reminders = data!.reminders
      .filter((r) => !r.done)
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 3);
    return (
      <>
        {heading(
          new Intl.DateTimeFormat(locale(language), {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(new Date()),
          name ? greeting + (language === "zh" ? "，" : ", ") + name : greeting,
          tr("Here's what matters today."),
          <div className="button-pair">
            {addButton("Project", () => openNew("project"), false)}
            {addButton("Add task", () => openNew("task"))}
          </div>,
          true,
        )}
        {onboarding()}
        <div className="metrics">
          {metric("Tasks today", String(todayTasks.length), "Scheduled for today")}
          {metric("Completed", String(done), "Today's finished work")}
          {metric(
            "In progress",
            String(data!.tasks.filter((t) => t.status === "IN_PROGRESS").length),
            "Across all projects",
          )}
          {metric(
            "Completion",
            todayTasks.length ? Math.round((done / todayTasks.length) * 100) + "%" : "0%",
            "Today’s tasks",
          )}
        </div>
        <section className={"card focus" + (data!.focus ? " is-running" : "")}>
          <div className="focushead">
            <small>
              <span aria-hidden="true">●</span> {tr("CURRENT FOCUS")}
            </small>
            <span>{proj(current?.projectId || null)?.name || tr("Your work")}</span>
          </div>
          <div className="focusbody">
            {current ? (
              <>
                <div>
                  <h2>{current.title}</h2>
                  <p>{current.description || tr("One clear next step. Make a little progress now.")}</p>
                  <div className="meta">
                    <span>
                      {language === "zh"
                        ? `${cap(current.priority)}优先级`
                        : `${cap(current.priority)} priority`}
                    </span>
                    <span>
                      <Clock3 size={14} />{" "}
                      {language === "zh"
                        ? `预计 ${duration(current.estimatedMinutes)}`
                        : `${duration(current.estimatedMinutes)} estimated`}
                    </span>
                    <span>
                      {tr("Due")} {formatDate(current.dueDate, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  {data!.focus && (
                    <div className={"timer" + (data!.focus.paused ? " paused" : "")}>{focusLabel}</div>
                  )}
                </div>
                <div className="button-pair">
                  {data!.focus ? (
                    <>
                      <button className="secondary" onClick={pauseFocus}>
                        {data!.focus.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
                        {tr(data!.focus.paused ? "Resume" : "Pause")}
                      </button>
                      <button className="secondary" onClick={() => endFocus(false)}>
                        {tr("End")}
                      </button>
                      <button className="primary" onClick={() => endFocus(true)}>
                        <Check size={15} /> {tr("Complete")}
                      </button>
                    </>
                  ) : (
                    <button className="primary" onClick={() => startFocus(current.id)}>
                      <Play size={15} /> {tr("Start focus")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <Empty
                title="No active focus"
                detail="Choose a task to start working."
                action={
                  data!.tasks.some((t) => t.status !== "DONE" && t.status !== "CANCELLED") ? (
                    <button className="primary" onClick={() => navigate("/tasks")}>
                      {tr("Select task")}
                    </button>
                  ) : (
                    addButton("Add task", () => openNew("task"))
                  )
                }
              />
            )}
          </div>
        </section>
        <div className="grid">
          {panel(
            "YOUR PRIORITIES",
            "Today",
            link("View all", "/tasks"),
            todayTasks.length ? (
              todayTasks.slice(0, 6).map(taskRow)
            ) : (
              <Empty
                title="No tasks today"
                detail="Add a task to give today a clear direction."
                action={addButton("Add task", () => openNew("task"), false)}
              />
            ),
          )}
          {panel(
            "ON THE CALENDAR",
            "Today’s schedule",
            link("Calendar", "/calendar"),
            agenda.length ? (
              agenda.map((e) => (
                <button
                  className="agenda event"
                  key={e.kind + e.id}
                  onClick={() => setModal({ kind: e.kind, id: e.id })}
                >
                  <time>{timeOf(e.at)}</time>
                  <i />
                  <span>
                    <strong>{e.title}</strong>
                    <small>{e.sub || tr(e.kind === "task" ? "Task" : "Reminder")}</small>
                  </span>
                </button>
              ))
            ) : (
              <Empty title="Open calendar" detail="No upcoming events today." />
            ),
          )}
        </div>
        <div className="grid lower">
          {panel(
            "MOVING FORWARD",
            "Active projects",
            link("Projects", "/projects"),
            activeProjects.length ? (
              activeProjects.slice(0, 4).map((p) => (
                <button className="project" key={p.id} onClick={() => navigate("/projects/" + p.id)}>
                  <strong>{p.name}</strong>
                  <Bar value={taskProgress(p)} />
                  <small>{taskProgress(p)}%</small>
                </button>
              ))
            ) : (
              <Empty
                title="No active projects"
                detail="Create a project to connect tasks to a larger outcome."
                action={addButton("Create project", () => openNew("project"), false)}
              />
            ),
          )}
          {panel(
            "KEEP IN MIND",
            "Reminders",
            link("View all", "/reminders"),
            reminders.length ? (
              reminders.map((r) => (
                <button
                  className="reminder"
                  key={r.id}
                  onClick={() => setModal({ kind: "reminder", id: r.id })}
                >
                  <b>!</b>
                  <span>
                    {r.title}
                    <small className={r.at < nowIso ? "overdue" : ""}>
                      {formatDate(r.at, { hour: "numeric", minute: "2-digit" })}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <Empty
                title="No upcoming reminders"
                detail="Nothing to remind you about."
                action={addButton("Add reminder", () => openNew("reminder"), false)}
              />
            ),
          )}
        </div>
        <div className="grid lower">
          {panel(
            "PERSONAL GROWTH",
            "Skills",
            link("Skills", "/growth"),
            data!.skills.length ? (
              data!.skills.slice(0, 4).map((s) => (
                <button
                  className="skill-row clickable"
                  key={s.id}
                  onClick={() => setModal({ kind: "skill", id: s.id })}
                >
                  <strong>{s.name}</strong>
                  <Bar value={s.level} />
                  <small>{s.level}%</small>
                </button>
              ))
            ) : (
              <Empty
                title="No skills yet"
                detail="Add a skill to measure your growth."
                action={addButton("Add skill", () => openNew("skill"), false)}
              />
            ),
          )}
          {panel(
            "THIS WEEK",
            "Time invested",
            link("Analytics", "/analytics"),
            ["FOCUS", "LEARNING", "MEETING"].map((type) => (
              <div className="time-row" key={type}>
                <span>{cap(type)}</span>
                <strong>
                  {duration(
                    data!.timeEntries
                      .filter((e) => e.type === type && new Date(e.startTime) >= weekStart())
                      .reduce((a, e) => a + e.duration, 0),
                  )}
                </strong>
              </div>
            )),
          )}
        </div>
      </>
    );
  };

  const tasksPage = () => {
    const pending = data!.tasks
      .filter((t) => t.status !== "DONE" && t.status !== "CANCELLED")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const done = data!.tasks
      .filter((t) => t.status === "DONE")
      .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
    return (
      <>
        {heading(
          "WORK",
          "Tasks",
          "A clear list of what needs attention.",
          addButton("Add task", () => openNew("task")),
        )}
        <div className="grid">
          {panel(
            "NEXT ACTIONS",
            "Open tasks",
            null,
            <>
              {quickAddForm()}
              {pending.length ? (
                pending.map(taskRow)
              ) : (
                <Empty title="All caught up" detail="There are no open tasks." />
              )}
            </>,
          )}
          {panel(
            "FINISHED",
            "Completed",
            null,
            done.length ? (
              done.map(taskRow)
            ) : (
              <Empty title="No completed tasks yet" detail="Finish a task to see it here." />
            ),
          )}
        </div>
      </>
    );
  };

  const projectsPage = () => {
    const visible = data!.projects.filter((p) => p.status !== "Archived");
    const archived = data!.projects.filter((p) => p.status === "Archived");
    const card = (p: Project) => {
      const ts = data!.tasks.filter((t) => t.projectId === p.id && t.status !== "CANCELLED");
      const next = data!.milestones.find((m) => m.projectId === p.id && !m.done);
      return (
        <button
          className={"card project-card" + (p.status === "Archived" ? " is-archived" : "")}
          key={p.id}
          onClick={() => navigate("/projects/" + p.id)}
        >
          <div className="project-card-top">
            <span className="project-symbol">{p.name[0]?.toUpperCase()}</span>
            <span className="status">{tr(p.status)}</span>
          </div>
          <h2>{p.name}</h2>
          <p>{p.description}</p>
          <div className="project-line">
            <span>{tr("Progress")}</span>
            <strong>{progress(ts)}%</strong>
          </div>
          <Bar value={progress(ts)} />
          <div className="project-card-foot">
            <span>
              {language === "zh"
                ? `${ts.filter((t) => t.status === "DONE").length} / ${ts.length} 项任务`
                : `${ts.filter((t) => t.status === "DONE").length} / ${ts.length} tasks`}
            </span>
            <span>{next ? tr("Next:") + " " + next.title : tr("Due") + " " + formatDate(p.dueDate)}</span>
          </div>
        </button>
      );
    };
    return (
      <>
        {heading(
          "WORK",
          "Projects",
          "See progress, milestones, and the next step for each project.",
          addButton("New project", () => openNew("project")),
        )}
        {visible.length || archived.length ? (
          <div className="project-grid">{[...visible, ...archived].map(card)}</div>
        ) : (
          <Empty
            title="No projects yet"
            detail="Create your first project to track progress."
            action={addButton("Create project", () => openNew("project"))}
          />
        )}
      </>
    );
  };

  const projectDetail = (id: string) => {
    const p = proj(id);
    if (!p)
      return (
        <Empty
          title="Project not found"
          detail="It may have been deleted."
          action={
            <button className="secondary" onClick={() => navigate("/projects")}>
              {tr("Back to projects")}
            </button>
          }
        />
      );
    const ts = data!.tasks.filter((t) => t.projectId === id);
    const ms = [...data!.milestones.filter((m) => m.projectId === id)].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );
    const entries = data!.timeEntries.filter((e) => e.projectId === id);
    const archived = p.status === "Archived";
    return (
      <>
        <button className="back" onClick={() => navigate("/projects")}>
          <ChevronLeft size={14} /> {tr("All projects")}
        </button>
        {heading(
          tr(p.status).toUpperCase(),
          p.name,
          p.description,
          <div className="button-pair">
            <button className="secondary" onClick={() => setModal({ kind: "project", id })}>
              <Pencil size={15} /> {tr("Edit")}
            </button>
            <button className="primary" onClick={() => openNew("task", { projectId: id })}>
              <Plus size={15} /> {tr("Add task")}
            </button>
          </div>,
          true,
        )}
        <div className="metrics">
          {metric(
            "Task progress",
            progress(ts) + "%",
            (language === "zh" ? "已完成 " : "") +
              ts.filter((t) => t.status === "DONE").length +
              " / " +
              ts.length +
              (language === "zh" ? "" : " complete"),
          )}
          {metric(
            "Focus time",
            duration(entries.filter((e) => e.type === "FOCUS").reduce((a, e) => a + e.duration, 0)),
            "Tracked on this project",
          )}
          {metric(
            "Overdue",
            String(
              ts.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate < nowIso).length,
            ),
            "Tasks needing attention",
          )}
          {metric("Milestones", ms.filter((m) => m.done).length + " / " + ms.length, "Reached so far")}
        </div>
        <div className="grid">
          {panel(
            "PROJECT PLAN",
            "Milestones",
            <button onClick={() => openNew("milestone", { projectId: id })}>
              <Plus size={14} /> {tr("Add")}
            </button>,
            ms.length ? (
              ms.map((m) => (
                <div className="milestone-row" key={m.id}>
                  <Checkbox
                    checked={m.done}
                    aria-label={tr("Complete") + " " + m.title}
                    onCheckedChange={() =>
                      change((s) => {
                        const x = s.milestones.find((x) => x.id === m.id);
                        if (x) x.done = !x.done;
                      })
                    }
                  />
                  <button
                    className={m.done ? "crossed" : ""}
                    onClick={() => setModal({ kind: "milestone", id: m.id })}
                  >
                    {m.title}
                  </button>
                  <small>{formatDate(m.dueDate)}</small>
                </div>
              ))
            ) : (
              <Empty
                title="No milestones"
                detail="Add a milestone to mark key outcomes."
                action={
                  <button className="secondary" onClick={() => openNew("milestone", { projectId: id })}>
                    <Plus size={15} /> {tr("Milestone")}
                  </button>
                }
              />
            ),
          )}
          {panel(
            "PROJECT WORK",
            "Tasks",
            null,
            <>
              {quickAddForm(id)}
              {ts.length ? (
                ts.map(taskRow)
              ) : (
                <Empty title="No tasks" detail="Add the next action for this project." />
              )}
            </>,
          )}
        </div>
        <div className="grid lower">
          {panel(
            "CONTEXT",
            "Project notes",
            null,
            <div className="body-pad">
              <p className="notes">{p.notes || tr("No notes yet.")}</p>
              <div className="meta-list">
                <span>
                  {tr("Priority")} <strong>{cap(p.priority)}</strong>
                </span>
                <span>
                  {tr("Deadline")} <strong>{formatDate(p.dueDate)}</strong>
                </span>
                <span>
                  {tr("Skills")}{" "}
                  <strong>
                    {p.skillIds
                      .map((id) => skill(id)?.name || "")
                      .filter(Boolean)
                      .join(language === "zh" ? "、" : ", ") || tr("None assigned")}
                  </strong>
                </span>
              </div>
            </div>,
          )}
          {panel(
            "MANAGE",
            "Project actions",
            null,
            <div className="body-pad button-pair">
              <button
                className="secondary"
                onClick={() => {
                  change((s) => {
                    const x = s.projects.find((x) => x.id === id);
                    if (x) x.status = archived ? "Active" : "Archived";
                  });
                  notify(tr(archived ? "Project restored" : "Project archived"));
                }}
              >
                {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}{" "}
                {tr(archived ? "Unarchive" : "Archive")}
              </button>
              <button
                className="danger"
                onClick={() => {
                  remove("project", id);
                  navigate("/projects");
                }}
              >
                <Trash2 size={15} /> {tr("Delete")}
              </button>
            </div>,
          )}
        </div>
      </>
    );
  };

  const calendarPage = () => {
    const base = toDate(selectedDate);
    const start = new Date(base);
    if (view === "Month") {
      start.setDate(1);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    }
    if (view === "Week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const count = view === "Month" ? 42 : view === "Week" ? 7 : 1;
    const month = base.getMonth();
    const dates = Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return dateKey(d);
    });
    const events = (d: string) =>
      [
        ...data!.tasks
          .filter((t) => dayOf(t.dueDate) === d && t.status !== "CANCELLED")
          .map((t) => ({
            kind: "task" as const,
            id: t.id,
            title: t.title,
            at: t.dueDate,
            projectId: t.projectId,
          })),
        ...data!.reminders
          .filter((r) => dayOf(r.at) === d && !r.done)
          .map((r) => ({
            kind: "reminder" as const,
            id: r.id,
            title: r.title,
            at: r.at,
            projectId: r.projectId,
          })),
        ...data!.milestones
          .filter((m) => m.dueDate === d)
          .map((m) => ({
            kind: "milestone" as const,
            id: m.id,
            title: m.title,
            at: d,
            projectId: m.projectId,
          })),
        ...data!.timeEntries
          .filter((e) => dayOf(e.startTime) === d)
          .map((e) => ({
            kind: "time" as const,
            id: e.id,
            title: cap(e.type) + " · " + duration(e.duration),
            at: e.startTime,
            projectId: e.projectId,
          })),
      ].sort((a, b) => a.at.localeCompare(b.at));
    const move = (n: number) => {
      const d = new Date(base);
      if (view === "Month") d.setMonth(d.getMonth() + n);
      else d.setDate(d.getDate() + n * (view === "Week" ? 7 : 1));
      setSelectedDate(dateKey(d));
    };
    return (
      <>
        {heading(
          "TIME",
          "Calendar",
          "Your tasks, deadlines, milestones, sessions, and reminders.",
          <button className="primary" onClick={() => openNew("task", { date: selectedDate })}>
            <Plus size={16} /> {tr("Add task")}
          </button>,
        )}
        <section className="card calendar-card">
          <div className="calendar-toolbar">
            <div className="button-pair">
              <button className="square" onClick={() => move(-1)} aria-label={tr("Previous")}>
                <ChevronLeft size={17} />
              </button>
              <button className="square" onClick={() => move(1)} aria-label={tr("Next")}>
                <ChevronRight size={17} />
              </button>
              <button
                className="secondary"
                onClick={() => setSelectedDate(today)}
                disabled={selectedDate === today}
              >
                {tr("Today")}
              </button>
              <strong>
                {formatDate(selectedDate, {
                  month: "long",
                  year: "numeric",
                  day: view === "Day" ? "numeric" : undefined,
                })}
              </strong>
            </div>
            <div className="segmented">
              {(["Month", "Week", "Day"] as const).map((v) => (
                <button key={v} className={view === v ? "selected" : ""} onClick={() => setView(v)}>
                  {tr(v)}
                </button>
              ))}
            </div>
          </div>
          <div className={"calendar-grid " + view.toLowerCase()}>
            {dates.map((d) => (
              <div
                className={
                  "calendar-day" +
                  (d === today ? " is-today" : "") +
                  (view === "Month" && toDate(d).getMonth() !== month ? " is-outside" : "")
                }
                key={d}
              >
                <div className="day-top">
                  <button
                    className="day-num"
                    onClick={() => {
                      setSelectedDate(d);
                      setView("Day");
                    }}
                  >
                    {formatDate(d, { weekday: view === "Month" ? "short" : "long" })}{" "}
                    <strong>{d.slice(-2)}</strong>
                  </button>
                  <button
                    className="day-add"
                    onClick={() => openNew("task", { date: d })}
                    aria-label={tr("Add task") + " " + formatDate(d)}
                    title={tr("Add task")}
                  >
                    <Plus size={13} />
                  </button>
                </div>
                {events(d).map((e) => (
                  <button
                    className={"calendar-event " + e.kind}
                    key={e.kind + e.id}
                    onClick={() => openRecord(e.kind, e.id)}
                  >
                    <span>{e.title}</span>
                    <small>
                      {e.kind === "milestone" ? tr("Milestone") : timeOf(e.at)} ·{" "}
                      {proj(e.projectId)?.name || tr(baseCap(e.kind))}
                    </small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  const remindersPage = () => {
    const reminders = [...data!.reminders].sort(
      (a, b) => Number(a.done) - Number(b.done) || a.at.localeCompare(b.at),
    );
    const toggleReminder = (r: Reminder) => {
      let next = "";
      change((s) => {
        const x = s.reminders.find((x) => x.id === r.id);
        if (!x) return;
        if (x.recurrence === "None") {
          x.done = !x.done;
          return;
        }
        const d = new Date(x.at);
        do {
          if (x.recurrence === "Daily") d.setDate(d.getDate() + 1);
          if (x.recurrence === "Weekly") d.setDate(d.getDate() + 7);
          if (x.recurrence === "Monthly") d.setMonth(d.getMonth() + 1);
        } while (d <= new Date());
        x.at = d.toISOString();
        x.done = false;
        next = x.at;
      });
      if (next) notify(tr("Next reminder") + ": " + formatDate(next, { hour: "numeric", minute: "2-digit" }));
    };
    return (
      <>
        {heading(
          "SYSTEM",
          "Reminders",
          "Keep commitments visible without crowding your task list.",
          addButton("Add reminder", () => openNew("reminder")),
        )}
        {panel(
          "UPCOMING",
          "All reminders",
          null,
          reminders.length ? (
            reminders.map((r) => (
              <div className="record-row interactive" key={r.id}>
                <Checkbox
                  checked={r.done}
                  onCheckedChange={() => toggleReminder(r)}
                  aria-label={tr("Complete") + " " + r.title}
                />
                <button className="row-title" onClick={() => setModal({ kind: "reminder", id: r.id })}>
                  <strong className={r.done ? "crossed" : ""}>{r.title}</strong>
                  <span>
                    {proj(r.projectId)?.name || tr("Personal")} · {tr(r.recurrence)}
                  </span>
                </button>
                <span className={r.at < nowIso && !r.done ? "overdue" : ""}>
                  {formatDate(r.at, { hour: "numeric", minute: "2-digit" })}
                </span>
                <button
                  className="row-icon"
                  onClick={() => remove("reminder", r.id)}
                  aria-label={tr("Delete")}
                  title={tr("Delete")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <Empty
              title="No reminders"
              detail="Add a reminder for something you don't want to miss."
              action={addButton("Add reminder", () => openNew("reminder"), false)}
            />
          ),
        )}
      </>
    );
  };

  const growthPage = () => {
    const categories = [...new Set(data!.skills.map((s) => s.category))];
    const weekKey = dateKey(weekStart());
    return (
      <>
        {heading(
          "GROWTH",
          "Personal growth",
          "Track your skills through deliberate practice and learning.",
          addButton("Add skill", () => openNew("skill")),
        )}
        <div className="grid">
          {categories.length ? (
            categories.map((c) =>
              panel(
                "SKILLS",
                c,
                null,
                data!.skills
                  .filter((s) => s.category === c)
                  .map((s) => (
                    <button
                      className="skill-row clickable"
                      key={s.id}
                      onClick={() => setModal({ kind: "skill", id: s.id })}
                    >
                      <strong>{s.name}</strong>
                      <Bar value={s.level} />
                      <small>{s.level}%</small>
                    </button>
                  )),
              ),
            )
          ) : (
            <section className="card">
              <Empty
                title="No skills yet"
                detail="Add a skill to measure your growth."
                action={addButton("Add skill", () => openNew("skill"), false)}
              />
            </section>
          )}
          {panel(
            "CONNECTED PRACTICE",
            "This week",
            link("Learning", "/learning"),
            <div className="body-pad">
              <div className="big-number">
                {duration(
                  data!.learning.filter((l) => l.date >= weekKey).reduce((a, l) => a + l.duration, 0),
                )}
              </div>
              <p>{tr("Learning recorded this week")}</p>
              <p>
                {data!.learning.length} {tr("total learning sessions")}
              </p>
            </div>,
          )}
        </div>
      </>
    );
  };

  const learningPage = () => {
    const sorted = [...data!.learning].sort((a, b) => b.date.localeCompare(a.date));
    const weekKey = dateKey(weekStart());
    return (
      <>
        {heading(
          "GROWTH",
          "Learning",
          "Record practice so progress has evidence.",
          addButton("Log learning", () => openNew("learning")),
        )}
        <div className="metrics">
          {metric(
            "This week",
            duration(data!.learning.filter((l) => l.date >= weekKey).reduce((a, l) => a + l.duration, 0)),
            "Learning time",
          )}
          {metric("Sessions", String(data!.learning.length), "Total recorded")}
          {metric(
            "Skills practiced",
            String(new Set(data!.learning.map((l) => l.skillId).filter(Boolean)).size),
            "Distinct skills",
          )}
          {metric("Latest", sorted.length ? formatDate(sorted[0].date) : "—", "Learning entry")}
        </div>
        {panel(
          "PRACTICE LOG",
          "Sessions",
          null,
          sorted.length ? (
            sorted.map((l) => (
              <div className="record-row interactive" key={l.id}>
                <BookOpen size={17} className="record-icon" />
                <button className="row-title" onClick={() => setModal({ kind: "learning", id: l.id })}>
                  <strong>{l.topic}</strong>
                  <span>
                    {skill(l.skillId)?.name || tr("General learning")} · {l.source || tr("No source")}
                  </span>
                </button>
                <span>{duration(l.duration)}</span>
                <span>{formatDate(l.date)}</span>
                <button
                  className="row-icon"
                  onClick={() => setModal({ kind: "learning", id: l.id })}
                  aria-label={tr("Edit")}
                  title={tr("Edit")}
                >
                  <Pencil size={15} />
                </button>
              </div>
            ))
          ) : (
            <Empty
              title="No learning sessions"
              detail="Log a session to see your practice over time."
              action={addButton("Log learning", () => openNew("learning"), false)}
            />
          ),
        )}
      </>
    );
  };

  const goalsPage = () => (
    <>
      {heading(
        "GROWTH",
        "Goals",
        "Connect daily work to outcomes that matter.",
        addButton("Add goal", () => openNew("goal")),
      )}
      {data!.goals.length ? (
        <div className="project-grid">
          {data!.goals.map((g) => (
            <button
              className="card goal-card project-card"
              key={g.id}
              onClick={() => setModal({ kind: "goal", id: g.id })}
            >
              <div className="project-card-top">
                <span className="status">{g.category || tr(g.status)}</span>
                <Pencil size={15} className="goal-edit" aria-hidden="true" />
              </div>
              <h2>{g.title}</h2>
              <p>{g.description}</p>
              <div className="project-line">
                <span>{tr("Progress")}</span>
                <strong>{g.progress}%</strong>
              </div>
              <Bar value={g.progress} />
              <div className="project-card-foot">
                <span>
                  {language === "zh"
                    ? `${g.projectIds.length} 个项目 · ${g.skillIds.length} 项技能`
                    : `${g.projectIds.length} projects · ${g.skillIds.length} skills`}
                </span>
                <span>
                  {tr("Target")} {formatDate(g.targetDate)}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="No goals yet"
          detail="Add a long-term outcome to connect your work."
          action={addButton("Add goal", () => openNew("goal"))}
        />
      )}
    </>
  );

  const reviewPage = () => {
    const start = weekStart();
    const weekKey = dateKey(start);
    const entries = data!.timeEntries.filter((e) => new Date(e.startTime) >= start),
      created = data!.tasks.filter((t) => new Date(t.createdAt) >= start),
      completed = data!.tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= start),
      overdue = data!.tasks.filter(
        (t) => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate < nowIso,
      ),
      learned = data!.learning.filter((l) => l.date >= weekKey).length,
      active = data!.projects.filter((p) => p.status === "Active").length,
      upcoming = data!.tasks
        .filter((t) => t.status !== "DONE" && t.status !== "CANCELLED")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 4);
    const top = data!.projects
      .map((p) => ({ p, n: completed.filter((t) => t.projectId === p.id).length }))
      .sort((a, b) => b.n - a.n)[0];
    return (
      <>
        {heading(
          tr("REVIEW"),
          tr("Weekly review"),
          formatDate(start.toISOString()) + " — " + formatDate(nowIso),
          null,
          true,
        )}
        <div className="metrics">
          {metric("Tasks created", String(created.length), "This week")}
          {metric("Tasks completed", String(completed.length), "This week")}
          {metric(
            "Completion rate",
            created.length ? Math.round((completed.length / created.length) * 100) + "%" : "—",
            "Completed / created",
          )}
          {metric(
            "Focus time",
            duration(entries.filter((e) => e.type === "FOCUS").reduce((a, e) => a + e.duration, 0)),
            "This week",
          )}
        </div>
        <div className="grid">
          {panel(
            "PROGRESS",
            "What moved forward",
            null,
            <div className="body-pad">
              {top && top.n > 0 ? (
                <p>
                  {language === "zh" ? (
                    <>
                      <strong>{top.p.name}</strong> 本周完成 {top.n} 项任务，进展最多。
                    </>
                  ) : (
                    <>
                      <strong>{top.p.name}</strong> led the week with {top.n} completed{" "}
                      {top.n === 1 ? "task" : "tasks"}.
                    </>
                  )}
                </p>
              ) : (
                <p>{tr("No completed project work recorded this week.")}</p>
              )}
              <p>
                {language === "zh"
                  ? `记录了 ${learned} 次学习。`
                  : `${learned} learning ${learned === 1 ? "session" : "sessions"} recorded.`}
              </p>
              <p>
                {language === "zh"
                  ? `${active} 个进行中的项目。`
                  : `${active} active ${active === 1 ? "project" : "projects"}.`}
              </p>
            </div>,
          )}
          {panel(
            "BOTTLENECKS",
            "Needs attention",
            null,
            <div className="body-pad">
              {overdue.length ? (
                <>
                  <p>
                    {language === "zh"
                      ? `${overdue.length} 项逾期任务：`
                      : `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}:`}
                  </p>
                  {overdue.slice(0, 4).map((t) => (
                    <button
                      className="list-link"
                      key={t.id}
                      onClick={() => setModal({ kind: "task", id: t.id })}
                    >
                      {t.title} <span>{proj(t.projectId)?.name || ""}</span>
                    </button>
                  ))}
                </>
              ) : (
                <p>{tr("No overdue tasks. Your current plan is on track.")}</p>
              )}
            </div>,
          )}
        </div>
        <div className="grid lower">
          {panel(
            "TIME",
            "Where time went",
            null,
            ["FOCUS", "LEARNING", "MEETING", "OTHER"].map((type) => (
              <div className="time-row" key={type}>
                <span>{cap(type)}</span>
                <strong>
                  {duration(entries.filter((e) => e.type === type).reduce((a, e) => a + e.duration, 0))}
                </strong>
              </div>
            )),
          )}
          {panel(
            "NEXT WEEK",
            "Keep momentum",
            null,
            upcoming.length ? (
              <div className="body-pad">
                {upcoming.map((t) => (
                  <button
                    className="list-link"
                    key={t.id}
                    onClick={() => setModal({ kind: "task", id: t.id })}
                  >
                    {t.title}
                    <span>{formatDate(t.dueDate)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="No tasks"
                detail="Upcoming tasks will show here."
                action={addButton("Add task", () => openNew("task"), false)}
              />
            ),
          )}
        </div>
      </>
    );
  };

  const analyticsPage = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(i - 6));
    const values = days.map((d) => ({
      d,
      done: data!.tasks.filter((t) => t.completedAt && dayOf(t.completedAt) === d).length,
      focus: data!.timeEntries
        .filter((e) => e.type === "FOCUS" && dayOf(e.startTime) === d)
        .reduce((a, e) => a + e.duration, 0),
    }));
    const max = Math.max(1, ...values.map((v) => v.done));
    const maxFocus = Math.max(1, ...values.map((v) => v.focus));
    const totalFocus = data!.timeEntries
      .filter((e) => e.type === "FOCUS")
      .reduce((a, e) => a + e.duration, 0);
    const weekday = (d: string) => formatDate(d, { weekday: "short", month: undefined, day: undefined });
    return (
      <>
        {heading(
          "REVIEW",
          "Analytics",
          "A simple view of what your time and actions produced.",
          addButton("Log time", () => openNew("time")),
        )}
        <div className="grid">
          {panel(
            "TASK COMPLETION",
            "Last 7 days",
            null,
            <div className="chart">
              {values.map((v) => (
                <div className="chart-col" key={v.d} title={`${formatDate(v.d)} · ${v.done}`}>
                  <div className="chart-track">
                    <i style={{ height: (v.done / max) * 100 + "%" }} />
                  </div>
                  <strong>{v.done}</strong>
                  <small>{weekday(v.d)}</small>
                </div>
              ))}
            </div>,
          )}
          {panel(
            "FOCUS TIME",
            "Last 7 days",
            null,
            <div className="chart">
              {values.map((v) => (
                <div className="chart-col" key={v.d} title={`${formatDate(v.d)} · ${duration(v.focus)}`}>
                  <div className="chart-track">
                    <i className="mint" style={{ height: (v.focus / maxFocus) * 100 + "%" }} />
                  </div>
                  <strong>{duration(v.focus)}</strong>
                  <small>{weekday(v.d)}</small>
                </div>
              ))}
            </div>,
          )}
        </div>
        <div className="grid lower">
          {panel(
            "PROJECT DISTRIBUTION",
            "Focus by project",
            null,
            totalFocus && data!.projects.length ? (
              data!.projects.map((p) => {
                const n = data!.timeEntries
                  .filter((e) => e.type === "FOCUS" && e.projectId === p.id)
                  .reduce((a, e) => a + e.duration, 0);
                return (
                  <div className="skill-row" key={p.id}>
                    <strong>{p.name}</strong>
                    <Bar value={(n / totalFocus) * 100} />
                    <small>{duration(n)}</small>
                  </div>
                );
              })
            ) : (
              <Empty title="No focus time recorded yet." detail="Choose a task to start working." />
            ),
          )}
          {panel(
            "SKILL GROWTH",
            "Progress",
            null,
            data!.skills.length ? (
              data!.skills.slice(0, 6).map((s) => (
                <div className="skill-row" key={s.id}>
                  <strong>{s.name}</strong>
                  <Bar value={s.level} />
                  <small>{s.level}%</small>
                </div>
              ))
            ) : (
              <Empty
                title="No skills yet"
                detail="Add a skill to measure your growth."
                action={addButton("Add skill", () => openNew("skill"), false)}
              />
            ),
          )}
        </div>
      </>
    );
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(latest.current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "personal-os-" + today + ".json";
    a.click();
    URL.revokeObjectURL(url);
    notify(tr("Backup exported"));
  };
  const importData = async (file: File) => {
    const before = latest.current;
    try {
      const x: unknown = JSON.parse(await file.text());
      if (!isState(x)) throw Error("This file is not a Personal OS backup.");
      save({ ...x, name: typeof x.name === "string" ? x.name : "", focus: x.focus ?? null });
      notify(tr("Backup imported"), before ? { label: tr("Undo"), run: () => save(before) } : undefined);
    } catch (e) {
      notify(
        tr(e instanceof Error && e.message.includes("Personal OS") ? e.message : "Could not import backup"),
      );
    }
  };
  const resetData = () => {
    const before = latest.current;
    if (!before) return;
    save({ ...freshState(), language: before.language, guideHidden: false });
    notify(tr("All data cleared"), { label: tr("Undo"), run: () => save(before) });
  };
  const shortcut = (keys: string[], label: string) => (
    <div className="shortcut-row" key={label}>
      <span>{tr(label)}</span>
      <span>
        {keys.map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </span>
    </div>
  );
  const settingsPage = () => (
    <>
      {heading("SYSTEM", "Settings", "Manage your workspace and keep a copy of your data.", null)}
      <div className="grid">
        {panel(
          "PROFILE",
          "Your workspace",
          null,
          <div className="body-pad settings-stack">
            <label className="form-field">
              <span>{tr("Display name")}</span>
              <input
                value={data!.name}
                placeholder={tr("Your name")}
                maxLength={40}
                onChange={(e) =>
                  change((s) => {
                    s.name = e.target.value;
                  })
                }
              />
            </label>
            <div className="form-field">
              <span>{tr("Language")}</span>
              <div className="segmented lang-settings">
                <button className={language === "zh" ? "selected" : ""} onClick={() => setLanguage("zh")}>
                  中文
                </button>
                <button className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>
                  English
                </button>
              </div>
            </div>
          </div>,
        )}
        {panel(
          "DATA",
          "Backup and restore",
          null,
          <div className="body-pad">
            <p>{tr("Data is stored only in this browser. Export a backup regularly.")}</p>
            <div className="button-pair">
              <button className="secondary" onClick={exportData}>
                <Download size={15} /> {tr("Export data")}
              </button>
              <label
                className="secondary file-button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.currentTarget.querySelector("input") as HTMLInputElement)?.click()
                }
              >
                <Upload size={15} /> {tr("Import data")}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importData(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="danger-zone">
              <strong>{tr("Reset workspace")}</strong>
              <p>{tr("Remove every record from this browser. You can undo right after.")}</p>
              <button className="danger" onClick={resetData}>
                <RotateCcw size={15} /> {tr("Clear all data")}
              </button>
            </div>
          </div>,
        )}
      </div>
      <div className="grid lower">
        {panel(
          "APP",
          "Install as an app",
          null,
          <div className="body-pad install-panel">
            {installed ? (
              <p>
                <Check size={15} /> {tr("Installed. Personal OS opens in its own window.")}
              </p>
            ) : installPrompt ? (
              <>
                <p>
                  {tr(
                    "Add Personal OS to your desktop or home screen. It opens in its own window and works offline.",
                  )}
                </p>
                <button className="primary" onClick={installApp}>
                  <MonitorDown size={15} /> {tr("Install app")}
                </button>
              </>
            ) : isIOS ? (
              <p>
                {tr("In Safari, tap")} <Share size={14} aria-label="Share" />{" "}
                {tr("then “Add to Home Screen”.")}
              </p>
            ) : (
              <p>
                {tr(
                  "Chrome / Edge: use the install icon in the address bar. Safari on Mac: File → Add to Dock. iPhone: Share → Add to Home Screen.",
                )}
              </p>
            )}
          </div>,
        )}
        {panel(
          "KEYBOARD",
          "Shortcuts",
          null,
          <div className="body-pad">
            {shortcut(["⌘", "K"], "Search and commands")}
            {shortcut(["N"], "New task")}
            {shortcut(["⌘", "Enter"], "Save form")}
            {shortcut(["←", "→"], "Switch page")}
            {shortcut(["Esc"], "Close dialog")}
          </div>,
        )}
      </div>
    </>
  );

  const entity =
    modal && data
      ? (
          {
            task: data.tasks,
            project: data.projects,
            reminder: data.reminders,
            learning: data.learning,
            skill: data.skills,
            goal: data.goals,
            milestone: data.milestones,
            time: data.timeEntries,
          }[modal.kind] as { id: string }[]
        ).find((x) => x.id === modal.id)
      : null;
  const field = (name: string, label: string, o: FieldOptions = {}) => (
    <label className="form-field" key={name}>
      <span>
        {tr(label)}
        {o.required && <em aria-hidden="true">*</em>}
      </span>
      <input
        name={name}
        type={o.type || "text"}
        defaultValue={o.value ?? ""}
        required={o.required}
        autoFocus={o.autoFocus}
        placeholder={o.placeholder}
        min={o.min}
        max={o.max}
      />
    </label>
  );
  const area = (name: string, label: string, value?: string) => (
    <label className="form-field" key={name}>
      <span>{tr(label)}</span>
      <textarea name={name} defaultValue={value || ""} />
    </label>
  );
  const select = (name: string, label: string, options: Option[], value = "") => (
    <label className="form-field" key={name}>
      <span>{tr(label)}</span>
      <select name={name} defaultValue={value}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const choice = (values: string[]): Option[] => values.map((v) => ({ value: v, label: cap(v) }));
  const checks = (name: string, label: string, items: { id: string; name: string }[], selected?: string[]) =>
    items.length ? (
      <div className="form-field" key={name}>
        <span>{tr(label)}</span>
        <div className="check-grid">
          {items.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                name={name}
                value={item.id}
                defaultChecked={selected?.includes(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      </div>
    ) : null;
  const pair = (...children: React.ReactNode[]) => <div className="form-row">{children}</div>;

  const formBody = () => {
    if (!modal || !data) return null;
    const x = entity as Record<string, any> | null;
    const pj: Option[] = [
      { value: "", label: tr("No project") },
      ...data.projects.map((p) => ({ value: p.id, label: p.name })),
    ];
    const sk: Option[] = [
      { value: "", label: tr("No skill") },
      ...data.skills.map((s) => ({ value: s.id, label: s.name })),
    ];
    const tasks: Option[] = [
      { value: "", label: tr("No task") },
      ...data.tasks
        .filter((t) => t.status !== "DONE" || t.id === x?.taskId)
        .map((t) => ({ value: t.id, label: t.title })),
    ];
    const priority = choice(["LOW", "MEDIUM", "HIGH", "URGENT"]);
    switch (modal.kind) {
      case "task":
        return (
          <>
            {field("title", "Task title", { value: x?.title, required: true, autoFocus: true })}
            {area("description", "Description / notes", x?.description)}
            {select("projectId", "Project", pj, x?.projectId || modal.projectId || "")}
            {pair(
              select(
                "status",
                "Status",
                choice(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
                x?.status || "TODO",
              ),
              select("priority", "Priority", priority, x?.priority || "MEDIUM"),
            )}
            {pair(
              field("dueDate", "Due date and time", {
                type: "datetime-local",
                value: x ? toLocalInput(x.dueDate) : `${modal.date || dateKey()}T17:00`,
                required: true,
              }),
              field("estimatedMinutes", "Estimate (minutes)", {
                type: "number",
                value: String(x?.estimatedMinutes ?? 30),
                min: 0,
              }),
            )}
            {field("tags", "Tags (comma separated)", { value: x?.tags?.join(", ") || "" })}
          </>
        );
      case "project":
        return (
          <>
            {field("name", "Project name", { value: x?.name, required: true, autoFocus: true })}
            {area("description", "Description", x?.description)}
            {pair(
              select(
                "status",
                "Status",
                choice(["Planning", "Active", "Paused", "Completed", "Archived"]),
                x?.status || "Active",
              ),
              select("priority", "Priority", priority, x?.priority || "MEDIUM"),
            )}
            {pair(
              field("dueDate", "Deadline", {
                type: "date",
                value: x?.dueDate || addDays(14),
                required: true,
              }),
              select(
                "goalId",
                "Connected goal",
                [
                  { value: "", label: tr("No goal") },
                  ...data.goals.map((g) => ({ value: g.id, label: g.title })),
                ],
                x?.goalId || "",
              ),
            )}
            {area("notes", "Notes", x?.notes)}
            {checks("skillIds", "Skills developed", data.skills, x?.skillIds)}
          </>
        );
      case "reminder":
        return (
          <>
            {field("title", "Reminder", { value: x?.title, required: true, autoFocus: true })}
            {pair(
              field("at", "Date and time", {
                type: "datetime-local",
                value: x ? toLocalInput(x.at) : `${modal.date || dateKey()}T10:00`,
                required: true,
              }),
              select(
                "recurrence",
                "Repeat",
                choice(["None", "Daily", "Weekly", "Monthly"]),
                x?.recurrence || "None",
              ),
            )}
            {select("taskId", "Related task", tasks, x?.taskId || "")}
            {select("projectId", "Related project", pj, x?.projectId || modal.projectId || "")}
          </>
        );
      case "learning":
        return (
          <>
            {field("topic", "Topic", { value: x?.topic, required: true, autoFocus: true })}
            {select("skillId", "Skill", sk, x?.skillId || "")}
            {pair(
              field("duration", "Duration (minutes)", {
                type: "number",
                value: String(x?.duration || 30),
                required: true,
                min: 1,
              }),
              field("date", "Date", { type: "date", value: x?.date || dateKey(), required: true }),
            )}
            {field("source", "Source", { value: x?.source || "" })}
            {area("notes", "Notes", x?.notes)}
          </>
        );
      case "skill":
        return (
          <>
            {field("name", "Skill name", { value: x?.name, required: true, autoFocus: true })}
            {select(
              "category",
              "Category",
              choice(["Creative", "Business", "Technology", "Communication", "Personal"]),
              x?.category || "Personal",
            )}
            {pair(
              field("level", "Current level (0–100)", {
                type: "number",
                value: String(x?.level ?? 0),
                required: true,
                min: 0,
                max: 100,
              }),
              field("targetLevel", "Target level", {
                type: "number",
                value: String(x?.targetLevel ?? 90),
                required: true,
                min: 1,
                max: 100,
              }),
            )}
            {area("description", "Description", x?.description)}
          </>
        );
      case "goal":
        return (
          <>
            {field("title", "Goal", { value: x?.title, required: true, autoFocus: true })}
            {area("description", "Description", x?.description)}
            {pair(
              field("category", "Category", { value: x?.category || "" }),
              select("status", "Status", choice(["Active", "Paused", "Completed"]), x?.status || "Active"),
            )}
            {pair(
              field("targetDate", "Target date", {
                type: "date",
                value: x?.targetDate || addDays(90),
                required: true,
              }),
              field("progress", "Progress (0–100)", {
                type: "number",
                value: String(x?.progress ?? 0),
                min: 0,
                max: 100,
              }),
            )}
            {checks("projectIds", "Connected projects", data.projects, x?.projectIds)}
            {checks("skillIds", "Connected skills", data.skills, x?.skillIds)}
          </>
        );
      case "time":
        return (
          <>
            {select("type", "Type", choice(["FOCUS", "LEARNING", "MEETING", "OTHER"]), x?.type || "MEETING")}
            {select("projectId", "Project", pj, x?.projectId || "")}
            {select("taskId", "Task", tasks, x?.taskId || "")}
            {pair(
              field("startTime", "Start", {
                type: "datetime-local",
                value: x ? toLocalInput(x.startTime) : `${modal.date || dateKey()}T10:00`,
                required: true,
              }),
              field("duration", "Duration (minutes)", {
                type: "number",
                value: String(x?.duration || 30),
                required: true,
                min: 1,
              }),
            )}
          </>
        );
      case "milestone":
        return (
          <>
            {field("title", "Milestone", { value: x?.title, required: true, autoFocus: true })}
            {pair(
              select(
                "projectId",
                "Project",
                data.projects.map((p) => ({ value: p.id, label: p.name })),
                x?.projectId || modal.projectId || data.projects[0]?.id,
              ),
              field("dueDate", "Due date", { type: "date", value: x?.dueDate || addDays(7), required: true }),
            )}
          </>
        );
    }
  };

  const submitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modal) return;
    const f = new FormData(e.currentTarget),
      s = (name: string) => String(f.get(name) || ""),
      n = (name: string) => Number(f.get(name) || 0),
      all = (name: string) => f.getAll(name).map(String),
      now = new Date().toISOString(),
      id = modal.id || uid();
    change((state) => {
      switch (modal.kind) {
        case "task": {
          const old = state.tasks.find((t) => t.id === id);
          const status = s("status") as Task["status"];
          const value: Task = {
            id,
            title: s("title").trim(),
            description: s("description"),
            status,
            priority: s("priority") as Task["priority"],
            projectId: s("projectId") || null,
            milestoneId: old?.milestoneId || null,
            dueDate: fromLocalInput(s("dueDate")),
            estimatedMinutes: Math.max(0, n("estimatedMinutes")),
            actualMinutes: old?.actualMinutes || 0,
            createdAt: old?.createdAt || now,
            completedAt: status === "DONE" ? old?.completedAt || now : null,
            tags: s("tags")
              .split(/[,，]/)
              .map((x) => x.trim())
              .filter(Boolean),
            order: old?.order ?? state.tasks.length + 1,
          };
          state.tasks = old ? state.tasks.map((t) => (t.id === id ? value : t)) : [...state.tasks, value];
          if (state.focus?.taskId === id && (status === "DONE" || status === "CANCELLED"))
            finishFocusIn(state);
          break;
        }
        case "project": {
          const old = state.projects.find((p) => p.id === id);
          const value: Project = {
            id,
            name: s("name").trim(),
            description: s("description"),
            status: s("status") as Project["status"],
            priority: s("priority") as Project["priority"],
            dueDate: s("dueDate"),
            goalId: s("goalId") || null,
            skillIds: all("skillIds"),
            notes: s("notes"),
            createdAt: old?.createdAt || now,
          };
          state.projects = old
            ? state.projects.map((p) => (p.id === id ? value : p))
            : [...state.projects, value];
          break;
        }
        case "reminder": {
          const old = state.reminders.find((r) => r.id === id);
          const value: Reminder = {
            id,
            title: s("title").trim(),
            at: fromLocalInput(s("at")),
            recurrence: s("recurrence") as Reminder["recurrence"],
            taskId: s("taskId") || null,
            projectId: s("projectId") || null,
            done: old?.done || false,
          };
          state.reminders = old
            ? state.reminders.map((r) => (r.id === id ? value : r))
            : [...state.reminders, value];
          break;
        }
        case "learning": {
          const old = state.learning.find((l) => l.id === id);
          const value: Learning = {
            id,
            topic: s("topic").trim(),
            skillId: s("skillId") || null,
            duration: Math.max(1, n("duration")),
            date: s("date"),
            notes: s("notes"),
            source: s("source"),
          };
          state.learning = old
            ? state.learning.map((l) => (l.id === id ? value : l))
            : [...state.learning, value];
          const at = toDate(value.date).toISOString();
          state.timeEntries = state.timeEntries.filter((x) => x.id !== "learning-" + id);
          state.timeEntries.push({
            id: "learning-" + id,
            taskId: null,
            projectId: null,
            startTime: at,
            endTime: at,
            duration: value.duration,
            type: "LEARNING",
          });
          break;
        }
        case "skill": {
          const old = state.skills.find((x) => x.id === id),
            level = Math.max(0, Math.min(100, n("level")));
          const value: Skill = {
            id,
            name: s("name").trim(),
            category: s("category"),
            level,
            targetLevel: Math.max(1, Math.min(100, n("targetLevel"))),
            description: s("description"),
            createdAt: old?.createdAt || now,
            history:
              old && old.level === level
                ? old.history
                : [...(old?.history || []), { date: dateKey(), level }],
          };
          state.skills = old ? state.skills.map((x) => (x.id === id ? value : x)) : [...state.skills, value];
          break;
        }
        case "goal": {
          const old = state.goals.find((x) => x.id === id);
          const value: Goal = {
            id,
            title: s("title").trim(),
            description: s("description"),
            category: s("category").trim(),
            targetDate: s("targetDate"),
            progress: Math.max(0, Math.min(100, n("progress"))),
            status: s("status") as Goal["status"],
            projectIds: all("projectIds"),
            skillIds: all("skillIds"),
          };
          state.goals = old ? state.goals.map((x) => (x.id === id ? value : x)) : [...state.goals, value];
          break;
        }
        case "time": {
          const old = state.timeEntries.find((x) => x.id === id);
          const start = new Date(s("startTime"));
          const minutes = Math.max(1, n("duration"));
          const value: TimeEntry = {
            id,
            taskId: s("taskId") || null,
            projectId: s("projectId") || null,
            startTime: start.toISOString(),
            endTime: new Date(start.getTime() + minutes * 60000).toISOString(),
            duration: minutes,
            type: s("type") as TimeEntry["type"],
          };
          state.timeEntries = old
            ? state.timeEntries.map((x) => (x.id === id ? value : x))
            : [...state.timeEntries, value];
          break;
        }
        case "milestone": {
          const old = state.milestones.find((x) => x.id === id);
          const value: Milestone = {
            id,
            projectId: s("projectId"),
            title: s("title").trim(),
            dueDate: s("dueDate"),
            done: old?.done || false,
          };
          state.milestones = old
            ? state.milestones.map((x) => (x.id === id ? value : x))
            : [...state.milestones, value];
          break;
        }
      }
    });
    setModal(null);
    notify(tr(modal.id ? "Saved" : "Added"));
  };

  const routes: Record<string, () => React.ReactNode> = {
    "/dashboard": dashboard,
    "/tasks": tasksPage,
    "/projects": projectsPage,
    "/calendar": calendarPage,
    "/reminders": remindersPage,
    "/growth": growthPage,
    "/learning": learningPage,
    "/goals": goalsPage,
    "/review": reviewPage,
    "/analytics": analyticsPage,
    "/settings": settingsPage,
  };
  const page = data
    ? (routes[path]?.() ??
      (path.startsWith("/projects/") ? (
        projectDetail(path.split("/")[2])
      ) : (
        <Empty
          title="Page not found"
          detail="Choose a section from the navigation."
          action={
            <button className="primary" onClick={() => navigate("/dashboard")}>
              {tr("Go to dashboard")}
            </button>
          }
        />
      )))
    : null;
  const section = groups.find(([, , href]) => isActive(href));
  const searchResults = data
    ? [
        ...data.tasks.map((x) => ({ kind: "task" as Kind, id: x.id, title: x.title, sub: "Task" })),
        ...data.projects.map((x) => ({ kind: "project" as Kind, id: x.id, title: x.name, sub: "Project" })),
        ...data.reminders.map((x) => ({
          kind: "reminder" as Kind,
          id: x.id,
          title: x.title,
          sub: "Reminder",
        })),
        ...data.skills.map((x) => ({ kind: "skill" as Kind, id: x.id, title: x.name, sub: "Skill" })),
        ...data.goals.map((x) => ({ kind: "goal" as Kind, id: x.id, title: x.title, sub: "Goal" })),
        ...data.learning.map((x) => ({
          kind: "learning" as Kind,
          id: x.id,
          title: x.topic,
          sub: "Learning",
        })),
      ]
    : [];

  return (
    <LanguageContext.Provider value={language}>
      <div className="shell">
        <aside className={"sidebar " + (menu ? "show" : "")}>
          <button className="brand" onClick={() => navigate("/dashboard")}>
            <b>P</b>personal<span>/os</span>
          </button>
          <nav>{navButtons}</nav>
          <button className="profile" onClick={() => navigate("/settings")} title={tr("Settings")}>
            <b>{data?.name.trim()[0]?.toUpperCase() || "P"}</b>
            <span>
              {data?.name.trim() || tr("Your workspace")}
              <small>{tr(saving ? "Saving…" : "Personal account")}</small>
            </span>
          </button>
        </aside>
        {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />}
        <main>
          <header>
            <div className="top-left">
              <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label={tr("Open menu")}>
                <Menu size={19} />
              </button>
              {tr("Workspace")} <span>/</span> {tr(section?.[1] || "Dashboard")}
              {path.startsWith("/projects/") && (
                <>
                  <span>/</span> {proj(path.split("/")[2])?.name || ""}
                </>
              )}
            </div>
            <div className="header-right">
              {installPrompt && !installed && (
                <button className="install-pill" onClick={installApp} title={tr("Install app")}>
                  <MonitorDown size={15} /> <span>{tr("Install app")}</span>
                </button>
              )}
              {data?.focus && path !== "/dashboard" && (
                <button
                  className={"focus-pill" + (data.focus.paused ? " paused" : "")}
                  onClick={() => navigate("/dashboard")}
                  title={task(data.focus.taskId)?.title}
                >
                  {data.focus.paused ? <Pause size={13} /> : <span className="pulse" aria-hidden="true" />}
                  {focusLabel}
                </button>
              )}
              <div className="lang-switch" role="group" aria-label={tr("Language")}>
                <button
                  type="button"
                  className={language === "zh" ? "selected" : ""}
                  onClick={() => setLanguage("zh")}
                >
                  中
                </button>
                <button
                  type="button"
                  className={language === "en" ? "selected" : ""}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
              </div>
              <button className="search" onClick={() => setSearch(true)}>
                <Search size={15} /> {tr("Search anything")} <kbd>⌘ K</kbd>
              </button>
              <button
                className="header-add"
                onClick={() => openNew("task")}
                aria-label={tr("Add task")}
                title={tr("New task") + " (N)"}
              >
                <Plus size={18} />
              </button>
            </div>
          </header>
          {error && (
            <div className="error-banner">
              {tr(error)}
              {data && <button onClick={retry}>{tr("Retry save")}</button>}
            </div>
          )}
          {loading ? (
            <div className="content">
              <div className="loading">{tr("Opening your workspace…")}</div>
            </div>
          ) : data ? (
            <div className="content paged-content">
              <PageDeck key={path} language={language} dashboard={path === "/dashboard"}>
                {page}
              </PageDeck>
            </div>
          ) : (
            <div className="content">
              <Empty
                title="Workspace unavailable"
                detail={error || "Please reload and try again."}
                action={
                  <div className="button-pair center">
                    <button className="primary" onClick={() => location.reload()}>
                      {tr("Reload")}
                    </button>
                    <label className="secondary file-button">
                      <Upload size={15} /> {tr("Import data")}
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const x: unknown = JSON.parse(await f.text());
                          if (isState(x)) {
                            saveState(x);
                            location.reload();
                          }
                        }}
                      />
                    </label>
                  </div>
                }
              />
            </div>
          )}
          <nav className="mobile-bottom">
            {mobileNav.map(([, name, href, Icon]) => (
              <button key={href} className={isActive(href) ? "active" : ""} onClick={() => navigate(href)}>
                <Icon size={19} />
                <span>{tr(name)}</span>
              </button>
            ))}
          </nav>
        </main>
        <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
          <DialogContent className="form-dialog" closeLabel={tr("Close")}>
            <DialogHeader>
              <DialogTitle>
                {modal
                  ? language === "zh"
                    ? `${modal.id ? "编辑" : "添加"}${kindLabel(modal.kind)}`
                    : `${modal.id ? "Edit" : "Add"} ${kindLabel(modal.kind)}`
                  : ""}
              </DialogTitle>
              <DialogDescription>
                {tr("Keep the details concise so the next action stays clear.")}
              </DialogDescription>
            </DialogHeader>
            {modal && (
              <form
                key={modal.kind + "-" + (modal.id || "new")}
                className="entity-form"
                onSubmit={submitForm}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.requestSubmit();
                  }
                }}
              >
                {formBody()}
                <div className="form-actions">
                  {modal.id && (
                    <button type="button" className="danger" onClick={() => remove(modal.kind, modal.id!)}>
                      <Trash2 size={15} /> {tr("Delete")}
                    </button>
                  )}
                  <button type="button" className="secondary" onClick={() => setModal(null)}>
                    {tr("Cancel")}
                  </button>
                  <button type="submit" className="primary" title="⌘ Enter">
                    <Check size={15} /> {tr("Save")}
                  </button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <CommandDialog
          open={search}
          onOpenChange={setSearch}
          title={tr("Search Personal OS")}
          description={tr("Search records or create something new")}
        >
          <CommandInput placeholder={tr("Search or choose an action…")} />
          <CommandList>
            <CommandEmpty>{tr("No results found.")}</CommandEmpty>
            <CommandGroup heading={tr("Quick add")}>
              {(["task", "project", "reminder", "learning", "goal", "skill"] as Kind[]).map((kind) => (
                <CommandItem
                  key={kind}
                  value={"create " + kind + " " + tr("Create") + tr(kind)}
                  onSelect={() => openNew(kind)}
                >
                  <Plus size={15} />
                  {language === "zh" ? `${tr("Create")}${kindLabel(kind)}` : `Create ${kindLabel(kind)}`}
                  {kind === "task" && <CommandShortcut>N</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={tr("Navigation")}>
              {groups.map(([, name, href, Icon]) => (
                <CommandItem key={href} value={"go " + name + " " + tr(name)} onSelect={() => navigate(href)}>
                  <Icon size={15} />
                  {tr("Go to")} {tr(name)}
                </CommandItem>
              ))}
            </CommandGroup>
            {searchResults.length > 0 && (
              <CommandGroup heading={tr("Search results")}>
                {searchResults.map((r, i) => (
                  <CommandItem
                    key={r.kind + r.id}
                    // zero-width suffix keeps values unique without adding searchable letters
                    value={r.title + " " + tr(r.sub) + "\u200b".repeat(i + 1)}
                    onSelect={() => {
                      setSearch(false);
                      if (r.kind === "project") navigate("/projects/" + r.id);
                      else setModal({ kind: r.kind, id: r.id });
                    }}
                  >
                    <Search size={14} />
                    <span>{r.title}</span>
                    <CommandShortcut>{tr(r.sub)}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              <span>{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.run();
                    dismissToast(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label={tr("Close")}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </LanguageContext.Provider>
  );
}
