"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addProject, subscribeToProjects, type Project } from "@/utils/firestore";

const ALL_OPTION = { id: "all", name: "All" } as const;

export function useProjectId(): string {
  const params = useSearchParams();
  const projectId = params.get("project") || ALL_OPTION.id;
  return projectId;
}

export default function ProjectSelector() {
  const router = useRouter();
  const params = useSearchParams();
  const project = params.get("project") || ALL_OPTION.id;
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => subscribeToProjects(setProjects), []);

  useEffect(() => {
    if (!params.get("project")) {
      const search = new URLSearchParams(Array.from(params.entries()));
      search.set("project", project);
      router.replace(`/?${search.toString()}`);
    }
  }, [params, project, router]);

  const onChange = (next: string) => {
    const search = new URLSearchParams(Array.from(params.entries()));
    search.set("project", next);
    router.push(`/?${search.toString()}`);
  };

  return (
    <div className="min-w-[200px] flex items-center gap-2">
      <Select value={project} onValueChange={(v) => {
        if (v === "__create__") {
          setCreating(true);
          return;
        }
        onChange(v);
      }}>
        <SelectTrigger>
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem key={ALL_OPTION.id} value={ALL_OPTION.id}>{ALL_OPTION.name}</SelectItem>
          {projects.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>{opt.id}</SelectItem>
          ))}
          <SelectItem value="__create__">+ Create project…</SelectItem>
        </SelectContent>
      </Select>

      {creating && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="New project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && newName.trim()) {
                const id = await addProject(newName);
                setNewName("");
                setCreating(false);
                onChange(id);
              } else if (e.key === 'Escape') {
                setNewName("");
                setCreating(false);
              }
            }}
          />
          <Button
            variant="secondary"
            onClick={async () => {
              if (!newName.trim()) return;
              const id = await addProject(newName);
              setNewName("");
              setCreating(false);
              onChange(id);
            }}
          >Create</Button>
        </div>
      )}
    </div>
  );
}


