import { Task } from "@/types/task";

export interface ExportData {
  tasks: Task[];
  people: string[];
}

export const exportToJson = (tasks: Task[], people: string[]) => {
  const data: ExportData = { tasks, people };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
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

export const importFromJson = async (): Promise<ExportData | null> => {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;
        if (Array.isArray(data.tasks) && Array.isArray(data.people)) {
          resolve(data);
        } else {
          alert("Invalid JSON file format");
          resolve(null);
        }
      } catch {
        alert("Invalid JSON file");
        resolve(null);
      }
    };
    input.click();
  });
};