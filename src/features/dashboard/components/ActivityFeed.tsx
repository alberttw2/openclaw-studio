"use client";

import { useMemo, useState } from "react";
import {
  type ActionCategory,
  type ActionEntry,
  ACTION_STYLES,
} from "../types";

type ActivityFeedProps = {
  actions: ActionEntry[];
  maxVisible?: number;
};

const CATEGORY_FILTERS: Array<{ value: ActionCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "tool_call", label: "Tools" },
  { value: "config_change", label: "Config" },
  { value: "cron_run", label: "Cron" },
  { value: "heartbeat", label: "Heartbeat" },
  { value: "session", label: "Session" },
  { value: "error", label: "Errors" },
  { value: "agent_lifecycle", label: "Lifecycle" },
];

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const ActivityFeed = ({ actions, maxVisible = 50 }: ActivityFeedProps) => {
  const [filter, setFilter] = useState<ActionCategory | "all">("all");

  const filtered = useMemo(() => {
    const source = filter === "all" ? actions : actions.filter((a) => a.category === filter);
    return source
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxVisible);
  }, [actions, filter, maxVisible]);

  const categoryBreakdown = useMemo(() => {
    const counts = new Map<ActionCategory, number>();
    for (const action of actions) {
      counts.set(action.category, (counts.get(action.category) ?? 0) + 1);
    }
    return counts;
  }, [actions]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Category legend bar */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        {Array.from(categoryBreakdown.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => {
            const style = ACTION_STYLES[cat];
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {style.label}
                </span>
                <span className={`font-mono text-[9px] font-bold ${style.text}`}>
                  {count}
                </span>
              </div>
            );
          })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_FILTERS.map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`rounded-md border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] transition ${
                active
                  ? "border-border bg-surface-2 text-foreground"
                  : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-surface-2"
              }`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No actions recorded yet.
          </div>
        ) : (
          <div className="relative pl-4">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/60" />
            <div className="flex flex-col gap-1">
              {filtered.map((action) => {
                const style = ACTION_STYLES[action.category];
                return (
                  <div
                    key={action.id}
                    className={`group relative rounded-md border ${style.border} ${style.bg} px-3 py-2 transition hover:brightness-105`}
                  >
                    {/* Dot on the timeline */}
                    <div
                      className={`absolute -left-4 top-3 h-2.5 w-2.5 rounded-full border-2 border-background ${style.dot}`}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] ${style.bg} ${style.text} border ${style.border}`}
                          >
                            {style.label}
                          </span>
                          <span className="truncate font-mono text-[10px] font-semibold text-foreground">
                            {action.agentName}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] leading-relaxed text-foreground/80">
                          {action.summary}
                        </p>
                        {action.detail ? (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                            {action.detail}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                        {formatRelativeTime(action.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
