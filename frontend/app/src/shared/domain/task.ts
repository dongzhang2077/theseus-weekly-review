export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type TaskCreationSource = "user" | "assistant_approved" | "imported";

export interface TaskRecord {
  id: number;
  userId: number;
  projectId: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  estimatedMinutes: number | null;
  dueDate: string | null;
  createdSource: TaskCreationSource;
  completedAt: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreateDraft {
  projectId: number;
  title: string;
  description: string;
  priority: number;
  estimatedMinutes: number | null;
  dueDate: string | null;
}

export interface TaskUpdateDraft {
  expectedVersion: number;
  title?: string;
  description?: string | null;
  priority?: number;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  status?: TaskStatus;
  archived?: boolean;
}
