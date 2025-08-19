"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Download, Filter, MoreHorizontal, Plus, Upload, X } from "lucide-react";

// --------------------------------------------------------------
// Team Inbox (ICE-only)
// One simple prioritization: ICE = Impact × Confidence × Ease
// Each scored 1–5 (higher is better). Completed items sink to bottom.
// Ties: higher Impact → higher Ease → higher Confidence → older createdAt.
// --------------------------------------------------------------

type Score = 1 | 2 | 3 | 4 | 5;

type Task = {
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

const LS_TASKS_KEY = "team_inbox_tasks_v1";
const LS_PEOPLE_KEY = "team_inbox_people_v1";
const LS_PREFS_KEY = "team_inbox_prefs_v1";

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Page() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<string[]>(["Alice", "Bob", "Charlie"]);

  // Filters / prefs
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [showDone, setShowDone] = useState(false);

  // Dialogs
  const [newOpen, setNewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId) || null, [activeId, tasks]);

  const [draft, setDraft] = useState<Omit<Task, "id" | "createdAt">>({
    title: "",
    notes: "",
    impact: 3,
    confidence: 3,
    ease: 3,
    assignee: undefined,
    done: false,
  });

  // Keyboard shortcuts (⌘K open filters, ⌘N new)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setFiltersOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && (k === "n")) {
        e.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load / Save (+migration from old priority/effort model)
  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_TASKS_KEY);
      const p = localStorage.getItem(LS_PEOPLE_KEY);
      const prefs = localStorage.getItem(LS_PREFS_KEY);
      if (t) {
        const raw = JSON.parse(t);
        // Migrate if old shape detected
        const migrated: Task[] = raw?.map((item: any) => {
          if (item && typeof item === "object" && "priority" in item && !("impact" in item)) {
            // priority 1–3 → impact 1–5 (1→1, 2→3, 3→5)
            const impact = (Math.max(1, Math.min(3, Number(item.priority))) * 2 - 1) as Score;
            // effort 1–3 (1 tiny, 3 heavy) → ease 1–5 where easier is higher
            const effort = Math.max(1, Math.min(3, Number(item.effort)));
            const ease = (7 - 2 * effort) as Score; // 1→5, 2→3, 3→1
            const confidence: Score = 3; // neutral default
            return {
              id: item.id ?? rid(),
              title: String(item.title ?? "Untitled"),
              notes: String(item.notes ?? ""),
              impact, confidence, ease,
              assignee: item.assignee,
              done: Boolean(item.done),
              createdAt: Number(item.createdAt ?? Date.now()),
            } as Task;
          }
          return item as Task;
        }) ?? [];
        setTasks(migrated);
      }
      if (p) setPeople(JSON.parse(p));
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (typeof parsed.showDone === "boolean") setShowDone(parsed.showDone);
        if (typeof parsed.search === "string") setSearch(parsed.search);
        if (typeof parsed.assigneeFilter === "string") setAssigneeFilter(parsed.assigneeFilter);
      }
    } catch (e) {
      console.warn("Failed to load from localStorage", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(LS_PEOPLE_KEY, JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    localStorage.setItem(
      LS_PREFS_KEY,
      JSON.stringify({ showDone, search, assigneeFilter })
    );
  }, [showDone, search, assigneeFilter]);

  // Scoring
  const score = (t: Task) => {
    if (t.done) return -Infinity;
    return t.impact * t.confidence * t.ease; // ICE score
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesQ = !q ||
        t.title.toLowerCase().includes(q) ||
        (t.notes?.toLowerCase().includes(q) ?? false);
      const matchesAssignee =
        assigneeFilter === "all" || (assigneeFilter === "unassigned" ? !t.assignee : t.assignee === assigneeFilter);
      const matchesDone = showDone ? true : !t.done;
      return matchesQ && matchesAssignee && matchesDone;
    });
  }, [tasks, search, assigneeFilter, showDone]);

  const ordered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const sa = score(a);
      const sb = score(b);
      if (sb !== sa) return sb - sa; // desc score
      if (a.impact !== b.impact) return b.impact - a.impact;
      if (a.ease !== b.ease) return b.ease - a.ease;
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.createdAt - b.createdAt;
    });
  }, [filtered]);

  const addTask = () => {
    if (!draft.title.trim()) return;
    const newTask: Task = {
      id: rid(),
      createdAt: Date.now(),
      ...draft,
      title: draft.title.trim(),
      notes: draft.notes?.trim() || "",
    };
    setTasks((prev) => [newTask, ...prev]);
    setDraft({ title: "", notes: "", impact: 3, confidence: 3, ease: 3, assignee: undefined, done: false });
    setNewOpen(false);
  };

  const updateTask = (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.done));
  };

  const importFromJson = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        if (Array.isArray(data.people)) setPeople(data.people);
      } catch (e) {
        alert("Invalid JSON file");
      }
    };
    input.click();
  };

  const exportToJson = () => {
    const blob = new Blob([JSON.stringify({ tasks, people }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-inbox-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Inbox</h1>
          <p className="text-sm text-muted-foreground">One central list. ICE-ranked.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* New item dialog */}
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4"/>Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New item</DialogTitle>
                <DialogDescription>Add a concise title. Use notes for context.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  placeholder="Title (what needs to happen?)"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
                <Textarea
                  placeholder="Notes (optional)"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Impact</label>
                    <Select
                      value={String(draft.impact)}
                      onValueChange={(v) => setDraft((d) => ({ ...d, impact: Number(v) as Score }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Confidence</label>
                    <Select
                      value={String(draft.confidence)}
                      onValueChange={(v) => setDraft((d) => ({ ...d, confidence: Number(v) as Score }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ease</label>
                    <Select
                      value={String(draft.ease)}
                      onValueChange={(v) => setDraft((d) => ({ ...d, ease: Number(v) as Score }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Assignee</label>
                  <Select
                    value={draft.assignee ?? "_none"}
                    onValueChange={(v) => setDraft((d) => ({ ...d, assignee: v === "_none" ? undefined : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Unassigned</SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addTask} className="w-full">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Filters dialog trigger */}
          <Button variant="outline" className="gap-2" onClick={() => setFiltersOpen(true)}>
            <Filter className="h-4 w-4"/> Filters
          </Button>

          {/* Bulk actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Bulk actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={clearCompleted}>Remove completed</DropdownMenuItem>
              <DropdownMenuSeparator/>
              <DropdownMenuItem onClick={exportToJson} className="gap-2"><Download className="h-4 w-4"/>Export JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={importFromJson} className="gap-2"><Upload className="h-4 w-4"/>Import JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-20">Impact</TableHead>
                <TableHead className="w-28">Confidence</TableHead>
                <TableHead className="w-20">Ease</TableHead>
                <TableHead className="w-24 text-right">ICE</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((t) => (
                <TableRow key={t.id} className={cn(t.done && "opacity-60")}> 
                  <TableCell>
                    <Checkbox checked={t.done} onCheckedChange={(v) => updateTask(t.id, { done: Boolean(v) })} />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setActiveId(t.id)}
                      className="text-left"
                    >
                      <div className="font-medium leading-5 hover:underline cursor-pointer">{t.title}</div>
                      {t.notes && <div className="text-xs text-muted-foreground line-clamp-2">{t.notes}</div>}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(t.impact)}
                      onValueChange={(v) => updateTask(t.id, { impact: Number(v) as Score })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(t.confidence)}
                      onValueChange={(v) => updateTask(t.id, { confidence: Number(v) as Score })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(t.ease)}
                      onValueChange={(v) => updateTask(t.id, { ease: Number(v) as Score })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number.isFinite(score(t)) ? score(t).toFixed(0) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateTask(t.id, { done: !t.done })}>
                          {t.done ? "Mark as not done" : "Mark as done"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteTask(t.id)} className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}

              {ordered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No items yet. Add the first one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <footer className="text-xs text-muted-foreground text-center">
        Sort: <strong>ICE = Impact × Confidence × Ease</strong>. ⌘K Filters · ⌘N New
      </footer>

      {/* Filters Dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>Keep the list minimal. Open this only when needed.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Filters */}
            <section className="space-y-3">
              <div className="text-sm font-medium">Search & Assignee</div>
              <Input
                placeholder="Search title or notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assignees</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  <Checkbox id="showDone" checked={showDone} onCheckedChange={(v) => setShowDone(Boolean(v))} />
                  <label htmlFor="showDone" className="text-sm text-muted-foreground">Show completed</label>
                </div>
              </div>
            </section>

            <Separator />

            {/* Team */}
            <section className="space-y-3">
              <div className="text-sm font-medium">Team</div>
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <Badge key={p} variant="secondary" className="px-2 py-1 text-xs">
                    {p}
                    <button
                      onClick={() => setPeople((prev) => prev.filter((x) => x !== p))}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add member name"
                  onKeyDown={(e) => {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (e.key === "Enter" && v) {
                      setPeople((prev) => (prev.includes(v) ? prev : [...prev, v]));
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    const el = document.querySelector<HTMLInputElement>("input[placeholder='Add member name']");
                    const v = el?.value.trim();
                    if (v) {
                      setPeople((prev) => (prev.includes(v) ? prev : [...prev, v]));
                      if (el) el.value = "";
                    }
                  }}
                >Add</Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task detail dialog */}
      <Dialog open={!!activeTask} onOpenChange={(open) => setActiveId(open ? activeId : null)}>
        <DialogContent className="sm:max-w-2xl">
          {activeTask ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit task</DialogTitle>
                <DialogDescription>Fast, minimal, like a Notion page without the noise.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <Input
                  value={activeTask.title}
                  onChange={(e) => updateTask(activeTask.id, { title: e.target.value })}
                />
                <Textarea
                  placeholder="Notes"
                  value={activeTask.notes}
                  onChange={(e) => updateTask(activeTask.id, { notes: e.target.value })}
                  className="min-h-32"
                />

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Impact</label>
                    <Select
                      value={String(activeTask.impact)}
                      onValueChange={(v) => updateTask(activeTask.id, { impact: Number(v) as Score })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Confidence</label>
                    <Select
                      value={String(activeTask.confidence)}
                      onValueChange={(v) => updateTask(activeTask.id, { confidence: Number(v) as Score })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ease</label>
                    <Select
                      value={String(activeTask.ease)}
                      onValueChange={(v) => updateTask(activeTask.id, { ease: Number(v) as Score })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Assignee</label>
                    <Select
                      value={activeTask.assignee ?? "_none"}
                      onValueChange={(v) => updateTask(activeTask.id, { assignee: v === "_none" ? undefined : v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Unassigned</SelectItem>
                        {people.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Checkbox
                      id="detail-done"
                      checked={activeTask.done}
                      onCheckedChange={(v) => updateTask(activeTask.id, { done: Boolean(v) })}
                    />
                    <label htmlFor="detail-done" className="text-sm">Done</label>
                  </div>
                </div>
              </div>

              <DialogFooter className="justify-between">
                <Button variant="destructive" onClick={() => { deleteTask(activeTask.id); setActiveId(null); }}>Delete</Button>
                <Button onClick={() => setActiveId(null)}>Close</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}