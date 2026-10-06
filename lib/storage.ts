import { seed, type State } from "@/lib/model";

const STORAGE_KEY = "personal-os-state-v1";

export function isState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<State>;
  return (
    Array.isArray(state.tasks) &&
    Array.isArray(state.projects) &&
    Array.isArray(state.milestones) &&
    Array.isArray(state.reminders) &&
    Array.isArray(state.skills) &&
    Array.isArray(state.learning) &&
    Array.isArray(state.goals) &&
    Array.isArray(state.timeEntries)
  );
}

/** First visit: start empty, in the browser's language. */
export function freshState(): State {
  return seed(navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
}

export function loadState(): State {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed: unknown = JSON.parse(stored);
    if (!isState(parsed))
      throw new Error("Stored Personal OS data is invalid. Import a backup to restore it.");
    // Older versions used "there" as the placeholder name.
    if (parsed.name === "there") parsed.name = "";
    return parsed;
  }
  const initial = freshState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function saveState(state: State): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
