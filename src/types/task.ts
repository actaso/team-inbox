export type Score = 1 | 2 | 3 | 4 | 5;

export type Task = {
  id: string;
  title: string;
  notes?: string;
  impact: Score;     // 1–5
  confidence: Score; // 1–5
  ease: Score;       // 1–5 (higher = easier)
  assignee?: string;
  done: boolean;
  createdAt: number; // epoch ms
};

export type TaskDraft = Omit<Task, "id" | "createdAt">;