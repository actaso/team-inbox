import { Task } from "@/types/task";

export const calculateTaskScore = (task: Task): number => {
  if (task.done) return -Infinity;
  return task.impact * task.confidence * task.ease; // ICE score
};

export const sortTasks = (tasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const sa = calculateTaskScore(a);
    const sb = calculateTaskScore(b);
    if (sb !== sa) return sb - sa; // desc score
    if (a.impact !== b.impact) return b.impact - a.impact;
    if (a.ease !== b.ease) return b.ease - a.ease;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return a.createdAt - b.createdAt;
  });
};