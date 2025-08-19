import { Task } from "@/types/task";

export const LS_TASKS_KEY = "team_inbox_tasks_v1";
export const LS_PEOPLE_KEY = "team_inbox_people_v1";
export const LS_PREFS_KEY = "team_inbox_prefs_v1";

export interface UserPreferences {
  showDone: boolean;
  search: string;
  assigneeFilter: string;
}

export const loadFromStorage = () => {
  try {
    const tasks = localStorage.getItem(LS_TASKS_KEY);
    const people = localStorage.getItem(LS_PEOPLE_KEY);
    const prefs = localStorage.getItem(LS_PREFS_KEY);

    const parsedTasks: Task[] = tasks ? JSON.parse(tasks) : [];
    const parsedPeople: string[] = people ? JSON.parse(people) : ["Alice", "Bob", "Charlie"];
    const parsedPrefs: Partial<UserPreferences> = prefs ? JSON.parse(prefs) : {};

    return { parsedTasks, parsedPeople, parsedPrefs };
  } catch (e) {
    console.warn("Failed to load from localStorage", e);
    return {
      parsedTasks: [],
      parsedPeople: ["Alice", "Bob", "Charlie"],
      parsedPrefs: {}
    };
  }
};

export const saveTasksToStorage = (tasks: Task[]) => {
  localStorage.setItem(LS_TASKS_KEY, JSON.stringify(tasks));
};

export const savePeopleToStorage = (people: string[]) => {
  localStorage.setItem(LS_PEOPLE_KEY, JSON.stringify(people));
};

export const savePrefsToStorage = (prefs: UserPreferences) => {
  localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs));
};