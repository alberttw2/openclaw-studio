"use client";

import { useCallback, useMemo, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import {
  type TaskItem,
  type TaskStatus,
  type TaskPriority,
  TASK_STATUS_STYLES,
  TASK_PRIORITY_STYLES,
} from "../types";

type TaskManagerProps = {
  agents: AgentState[];
  tasks: TaskItem[];
  onTasksChange: (tasks: TaskItem[]) => void;
};

const TASK_COLUMNS: TaskStatus[] = ["open", "in_progress", "blocked", "done"];

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const TaskManager = ({ agents, tasks, onTasksChange }: TaskManagerProps) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newAgentId, setNewAgentId] = useState<string>("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskItem[]>();
    for (const status of TASK_COLUMNS) {
      map.set(status, []);
    }
    for (const task of tasks) {
      const bucket = map.get(task.status);
      if (bucket) bucket.push(task);
    }
    for (const [, bucket] of map) {
      bucket.sort((a, b) => {
        const priorityOrder: Record<TaskPriority, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (diff !== 0) return diff;
        return b.updatedAt - a.updatedAt;
      });
    }
    return map;
  }, [tasks]);

  const handleCreate = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const now = Date.now();
    const agent = agents.find((a) => a.agentId === newAgentId) ?? null;
    const task: TaskItem = {
      id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
      description: newDescription.trim() || undefined,
      assignedAgentId: agent?.agentId ?? null,
      assignedAgentName: agent?.name ?? null,
      status: "open",
      priority: newPriority,
      createdAt: now,
      updatedAt: now,
    };
    onTasksChange([...tasks, task]);
    setNewTitle("");
    setNewDescription("");
    setNewPriority("medium");
    setNewAgentId("");
    setShowCreateForm(false);
  }, [agents, newAgentId, newDescription, newPriority, newTitle, onTasksChange, tasks]);

  const handleStatusChange = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      onTasksChange(
        tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, updatedAt: Date.now() } : t
        )
      );
    },
    [onTasksChange, tasks]
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      onTasksChange(tasks.filter((t) => t.id !== taskId));
    },
    [onTasksChange, tasks]
  );

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTaskId(taskId);
  }, []);

  const handleDrop = useCallback(
    (targetStatus: TaskStatus) => {
      if (!draggedTaskId) return;
      handleStatusChange(draggedTaskId, targetStatus);
      setDraggedTaskId(null);
    },
    [draggedTaskId, handleStatusChange]
  );

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Tasks ({tasks.length})
        </p>
        <button
          type="button"
          className="rounded-md border border-transparent bg-primary px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105"
          onClick={() => setShowCreateForm((prev) => !prev)}
        >
          {showCreateForm ? "Cancel" : "New Task"}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm ? (
        <div className="rounded-md border border-border/80 bg-surface-1 px-4 py-3">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-md border border-border/80 bg-surface-3 px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <textarea
              placeholder="Description (optional)..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border/80 bg-surface-3 px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="rounded-md border border-border/80 bg-surface-3 px-2 py-1.5 font-mono text-[10px] text-foreground"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select
                value={newAgentId}
                onChange={(e) => setNewAgentId(e.target.value)}
                className="rounded-md border border-border/80 bg-surface-3 px-2 py-1.5 font-mono text-[10px] text-foreground"
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
                onClick={handleCreate}
                disabled={!newTitle.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Kanban board */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto sm:grid-cols-2 xl:grid-cols-4">
        {TASK_COLUMNS.map((status) => {
          const style = TASK_STATUS_STYLES[status];
          const columnTasks = tasksByStatus.get(status) ?? [];
          return (
            <div
              key={status}
              className="flex flex-col gap-2 rounded-md border border-border/60 bg-surface-0 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(status)}
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] ${style.bg} ${style.text} border ${style.border}`}
                  >
                    {style.label}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
              </div>
              <div className="flex min-h-[100px] flex-col gap-1.5">
                {columnTasks.map((task) => {
                  const priorityStyle = TASK_PRIORITY_STYLES[task.priority];
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      className={`cursor-grab rounded-md border ${style.border} bg-surface-1 px-3 py-2 transition active:cursor-grabbing hover:bg-surface-2`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-[11px] font-semibold leading-tight text-foreground">
                          {task.title}
                        </p>
                        <button
                          type="button"
                          className="shrink-0 font-mono text-[9px] text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(task.id)}
                          title="Delete task"
                        >
                          x
                        </button>
                      </div>
                      {task.description ? (
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-foreground/70">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1 py-0.5 font-mono text-[7px] font-bold uppercase tracking-[0.1em] ${priorityStyle.bg} ${priorityStyle.text} border ${priorityStyle.border}`}
                        >
                          {priorityStyle.label}
                        </span>
                        {task.assignedAgentName ? (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">
                            {task.assignedAgentName}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-mono text-[8px] text-muted-foreground">
                          {formatDate(task.updatedAt)}
                        </span>
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleStatusChange(task.id, e.target.value as TaskStatus)
                          }
                          className="rounded border border-border/60 bg-transparent px-1 py-0.5 font-mono text-[8px] text-muted-foreground"
                        >
                          {TASK_COLUMNS.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_STYLES[s].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
