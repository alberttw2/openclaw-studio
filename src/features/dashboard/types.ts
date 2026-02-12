/**
 * Agent action classification and color-coding system for the OpenClaw Dashboard.
 *
 * Each action category maps to a semantic color that works in both light and dark modes.
 */

export type ActionCategory =
  | "chat"
  | "tool_call"
  | "config_change"
  | "cron_run"
  | "heartbeat"
  | "session"
  | "error"
  | "agent_lifecycle";

export type ActionEntry = {
  id: string;
  agentId: string;
  agentName: string;
  category: ActionCategory;
  summary: string;
  detail?: string;
  timestamp: number;
};

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export type TaskItem = {
  id: string;
  title: string;
  description?: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
};

/** CSS class tokens for each action category (border, bg, text). */
export const ACTION_STYLES: Record<
  ActionCategory,
  { border: string; bg: string; text: string; dot: string; label: string }
> = {
  chat: {
    border: "border-sky-400/40",
    bg: "bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    label: "Chat",
  },
  tool_call: {
    border: "border-violet-400/40",
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
    label: "Tool Call",
  },
  config_change: {
    border: "border-amber-400/40",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Config",
  },
  cron_run: {
    border: "border-emerald-400/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "Cron",
  },
  heartbeat: {
    border: "border-teal-400/40",
    bg: "bg-teal-500/10",
    text: "text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500",
    label: "Heartbeat",
  },
  session: {
    border: "border-indigo-400/40",
    bg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500",
    label: "Session",
  },
  error: {
    border: "border-red-400/40",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    label: "Error",
  },
  agent_lifecycle: {
    border: "border-orange-400/40",
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
    label: "Lifecycle",
  },
};

export const TASK_STATUS_STYLES: Record<
  TaskStatus,
  { border: string; bg: string; text: string; label: string }
> = {
  open: {
    border: "border-slate-400/40",
    bg: "bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
    label: "Open",
  },
  in_progress: {
    border: "border-blue-400/40",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    label: "In Progress",
  },
  blocked: {
    border: "border-red-400/40",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    label: "Blocked",
  },
  done: {
    border: "border-emerald-400/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Done",
  },
};

export const TASK_PRIORITY_STYLES: Record<
  TaskPriority,
  { border: string; bg: string; text: string; label: string }
> = {
  low: {
    border: "border-slate-300/40",
    bg: "bg-slate-400/10",
    text: "text-slate-500 dark:text-slate-400",
    label: "Low",
  },
  medium: {
    border: "border-blue-300/40",
    bg: "bg-blue-400/10",
    text: "text-blue-500 dark:text-blue-400",
    label: "Medium",
  },
  high: {
    border: "border-amber-300/40",
    bg: "bg-amber-400/10",
    text: "text-amber-600 dark:text-amber-400",
    label: "High",
  },
  critical: {
    border: "border-red-300/40",
    bg: "bg-red-400/10",
    text: "text-red-600 dark:text-red-400",
    label: "Critical",
  },
};

/** Derive actions from agent state snapshots. */
export const classifyAgentAction = (
  agentId: string,
  agentName: string,
  eventType: string,
  message?: string
): ActionEntry => {
  const now = Date.now();
  const id = `${agentId}-${now}-${Math.random().toString(36).slice(2, 8)}`;

  let category: ActionCategory = "chat";
  let summary = message ?? eventType;

  if (eventType === "error" || eventType === "run-error") {
    category = "error";
    summary = message ?? "Agent encountered an error";
  } else if (eventType === "tool-call" || eventType === "tool-result") {
    category = "tool_call";
    summary = message ?? "Tool invocation";
  } else if (eventType === "heartbeat" || eventType === "heartbeat-response") {
    category = "heartbeat";
    summary = message ?? "Heartbeat check";
  } else if (eventType === "cron" || eventType === "cron-run") {
    category = "cron_run";
    summary = message ?? "Cron job executed";
  } else if (
    eventType === "config-patch" ||
    eventType === "rename" ||
    eventType === "settings-change"
  ) {
    category = "config_change";
    summary = message ?? "Configuration updated";
  } else if (
    eventType === "session-reset" ||
    eventType === "session-create" ||
    eventType === "session-start"
  ) {
    category = "session";
    summary = message ?? "Session lifecycle event";
  } else if (
    eventType === "agent-create" ||
    eventType === "agent-delete" ||
    eventType === "run-start" ||
    eventType === "run-end"
  ) {
    category = "agent_lifecycle";
    summary = message ?? "Agent lifecycle event";
  } else {
    category = "chat";
    summary = message ?? "Chat message";
  }

  return { id, agentId, agentName, category, summary, timestamp: now };
};
