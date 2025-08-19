"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { UserButton, useUser } from '@clerk/nextjs';

import { Task, TaskDraft, Score } from "@/types/task";
import { calculateTaskScore, sortTasks } from "@/utils/task-scoring";
import { 
  loadFromStorage, 
  savePrefsToStorage,
  UserPreferences 
} from "@/utils/storage";
import { exportToJson, importFromJson } from "@/utils/import-export";
import {
  subscribeToTasks,
  subscribeToPeople,
  addTask as addTaskToFirestore,
  updateTask as updateTaskInFirestore,
  deleteTask as deleteTaskFromFirestore,
  addPerson,
  removePerson
} from "@/utils/firestore";
import { initializeCurrentUser } from "@/utils/team-initialization";

export default function TeamInbox() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<string[]>([]);

  // Filters / prefs
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [showDone, setShowDone] = useState(true);

  // Dialogs
  const [newOpen, setNewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId) || null, [activeId, tasks]);

  const [draft, setDraft] = useState<TaskDraft>({
    title: "",
    notes: "",
    impact: 3,
    confidence: 3,
    ease: 3,
    assignee: undefined,
    done: false,
  });


  // Load preferences from localStorage and subscribe to Firestore data
  useEffect(() => {
    if (!user?.id) return;

    // Load user-specific preferences using user ID as key
    const { parsedPrefs } = loadFromStorage(`user-${user.id}`);
    if (typeof parsedPrefs.showDone === "boolean") setShowDone(parsedPrefs.showDone);
    if (typeof parsedPrefs.search === "string") setSearch(parsedPrefs.search);
    if (typeof parsedPrefs.assigneeFilter === "string") setAssigneeFilter(parsedPrefs.assigneeFilter);

    // Initialize current user as a team member
    if (user) {
      initializeCurrentUser(user);
    }

    // Subscribe to Firestore data (shared across all users)
    const unsubscribeTasks = subscribeToTasks(setTasks);
    const unsubscribePeople = subscribeToPeople(setPeople);

    return () => {
      unsubscribeTasks();
      unsubscribePeople();
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const prefs: UserPreferences = { showDone, search, assigneeFilter };
    savePrefsToStorage(prefs, `user-${user.id}`);
  }, [showDone, search, assigneeFilter, user?.id]);

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

  const ordered = useMemo(() => sortTasks(filtered), [filtered]);

  const addTask = async () => {
    if (!draft.title.trim() || !user?.id) return;
    
    const taskData = {
      ...draft,
      title: draft.title.trim(),
      notes: draft.notes?.trim() || "",
      createdAt: Date.now(),
    };

    try {
      await addTaskToFirestore(taskData, user.id);
      setDraft({ title: "", notes: "", impact: 3, confidence: 3, ease: 3, assignee: undefined, done: false });
      setNewOpen(false);
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    try {
      await updateTaskInFirestore(id, patch);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteTaskFromFirestore(id);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const clearCompleted = useCallback(async () => {
    const completedTasks = tasks.filter(t => t.done);
    try {
      await Promise.all(completedTasks.map(task => deleteTaskFromFirestore(task.id)));
    } catch (error) {
      console.error('Error clearing completed tasks:', error);
    }
  }, [tasks]);

  const handleImport = useCallback(async () => {
    if (!user?.id) return;
    
    const data = await importFromJson();
    if (data) {
      try {
        // Import tasks
        for (const task of data.tasks) {
          await addTaskToFirestore(task, user.id);
        }
        
        // Import people
        for (const person of data.people) {
          if (!people.includes(person)) {
            await addPerson(person);
          }
        }
      } catch (error) {
        console.error('Error importing data:', error);
      }
    }
  }, [user?.id, people]);

  const handleExport = useCallback(() => {
    exportToJson(tasks, people);
  }, [tasks, people]);

  // Comprehensive keyboard shortcuts for fast workflow
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const cmd = e.metaKey || e.ctrlKey;
      
      // Don't trigger shortcuts when typing in inputs
      const isTyping = ['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase());
      if (isTyping && !cmd) return;

      // Single key shortcuts (when not typing)
      if (!isTyping) {
        // N: New task
        if (k === "n") {
          e.preventDefault();
          setNewOpen(true);
        }
        
        // K: Open filters
        if (k === "k") {
          e.preventDefault();
          setFiltersOpen(true);
        }
        
        // E: Export
        if (k === "e") {
          e.preventDefault();
          handleExport();
        }
        
        // I: Import
        if (k === "i") {
          e.preventDefault();
          handleImport();
        }
        
        // D: Toggle show done
        if (k === "d") {
          e.preventDefault();
          setShowDone(prev => !prev);
        }
        
        // C: Clear completed tasks
        if (k === "c") {
          e.preventDefault();
          clearCompleted();
        }
      }
      
      // Escape: Close dialogs
      if (k === "escape") {
        e.preventDefault();
        setNewOpen(false);
        setFiltersOpen(false);
        setActiveId(null);
      }
      
      // / (slash): Focus search
      if (k === "/" && !isTyping) {
        e.preventDefault();
        setFiltersOpen(true);
        // Focus search input after dialog opens
        setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
          searchInput?.focus();
        }, 100);
      }
      
      // Numbers 1-5: Quick ICE scoring when editing task
      if (['1','2','3','4','5'].includes(k) && activeTask && !isTyping) {
        const score = Number(k) as Score;
        // Shift + number: set impact
        if (e.shiftKey) {
          e.preventDefault();
          updateTask(activeTask.id, { impact: score });
        }
        // Alt + number: set confidence  
        else if (e.altKey) {
          e.preventDefault();
          updateTask(activeTask.id, { confidence: score });
        }
        // Ctrl + number: set ease
        else if (cmd) {
          e.preventDefault();
          updateTask(activeTask.id, { ease: score });
        }
      }
      
      // Space: Toggle task completion (when task is selected)
      if (k === " " && activeTask && !isTyping) {
        e.preventDefault();
        updateTask(activeTask.id, { done: !activeTask.done });
      }
    };
    
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTask, handleExport, handleImport, clearCompleted]);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Inbox</h1>
          <p className="text-sm text-muted-foreground">One central list. ICE-ranked.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm text-muted-foreground">
              {user?.firstName || user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton />
          </div>
          {/* New item dialog */}
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4"/>Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New item</DialogTitle>
                <DialogDescription>Add a concise title. Use notes for context. Press ⌘+Enter to save quickly.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  placeholder="Title (what needs to happen?)"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                />
                <Textarea
                  placeholder="Notes (optional)"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      addTask();
                    }
                  }}
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
              <DropdownMenuItem onClick={handleExport} className="gap-2"><Download className="h-4 w-4"/>Export JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={handleImport} className="gap-2"><Upload className="h-4 w-4"/>Import JSON</DropdownMenuItem>
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
                      className="text-left w-full"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium leading-5 hover:underline cursor-pointer flex-1">{t.title}</div>
                        {t.assignee ? (
                          <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                            {t.assignee}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground border-dashed">
                            unassigned
                          </Badge>
                        )}
                      </div>
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
                    {Number.isFinite(calculateTaskScore(t)) ? calculateTaskScore(t).toFixed(0) : "—"}
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

      <footer className="text-xs text-muted-foreground text-center space-y-1">
        <div>Sort: <strong>ICE = Impact × Confidence × Ease</strong></div>
        <div className="text-xs opacity-75">
          <strong>N</strong> New · <strong>K</strong> Filters · <strong>/</strong> Search · <strong>D</strong> Toggle Done · <strong>E</strong> Export · <strong>R</strong> Clear · <strong>ESC</strong> Close
        </div>
        <div className="text-xs opacity-60">
          Task editing: <strong>Shift+1-5</strong> Impact · <strong>Alt+1-5</strong> Confidence · <strong>⌘+1-5</strong> Ease · <strong>Space</strong> Toggle Done · <strong>⌘+Enter</strong> Save/Close
        </div>
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
                      onClick={async () => {
                        try {
                          await removePerson(p);
                        } catch (error) {
                          console.error('Error removing person:', error);
                        }
                      }}
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
                  onKeyDown={async (e) => {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (e.key === "Enter" && v) {
                      if (!people.includes(v)) {
                        try {
                          await addPerson(v);
                          (e.target as HTMLInputElement).value = "";
                        } catch (error) {
                          console.error('Error adding person:', error);
                        }
                      }
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const el = document.querySelector<HTMLInputElement>("input[placeholder='Add member name']");
                    const v = el?.value.trim();
                    if (v && !people.includes(v)) {
                      try {
                        await addPerson(v);
                        if (el) el.value = "";
                      } catch (error) {
                        console.error('Error adding person:', error);
                      }
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
                <DialogDescription>Fast, minimal, like a Notion page without the noise. Press ⌘+Enter to close.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <Input
                  value={activeTask.title}
                  onChange={(e) => updateTask(activeTask.id, { title: e.target.value })}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      setActiveId(null);
                    }
                  }}
                />
                <Textarea
                  placeholder="Notes"
                  value={activeTask.notes}
                  onChange={(e) => updateTask(activeTask.id, { notes: e.target.value })}
                  className="min-h-32"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      setActiveId(null);
                    }
                  }}
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