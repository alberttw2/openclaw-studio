"use client";

import { useMemo } from "react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentAvatar } from "@/features/agents/components/AgentAvatar";
import type { ActionEntry } from "../types";
import { ACTION_STYLES } from "../types";

type DashboardOverviewProps = {
  agents: AgentState[];
  actions: ActionEntry[];
  onSelectAgent: (agentId: string) => void;
};

const formatTimestamp = (ts: number | null): string => {
  if (!ts) return "--";
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const StatusDot = ({ status }: { status: AgentState["status"] }) => {
  const colors: Record<AgentState["status"], string> = {
    idle: "bg-slate-400",
    running: "bg-emerald-500 animate-pulse",
    error: "bg-red-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
};

export const DashboardOverview = ({
  agents,
  actions,
  onSelectAgent,
}: DashboardOverviewProps) => {
  const stats = useMemo(() => {
    const total = agents.length;
    const running = agents.filter((a) => a.status === "running").length;
    const idle = agents.filter((a) => a.status === "idle").length;
    const errored = agents.filter((a) => a.status === "error").length;
    const totalActions = actions.length;
    const last5min = actions.filter((a) => Date.now() - a.timestamp < 300_000).length;
    const errors = actions.filter((a) => a.category === "error").length;
    return { total, running, idle, errored, totalActions, last5min, errors };
  }, [agents, actions]);

  const recentActionsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    const recent = actions.filter((a) => Date.now() - a.timestamp < 3_600_000);
    for (const action of recent) {
      counts.set(action.category, (counts.get(action.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [actions]);

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const statusOrder = { running: 0, error: 1, idle: 2 };
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
    });
  }, [agents]);

  return (
    <div className="flex flex-col gap-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Agents" value={stats.total} color="text-foreground" />
        <MetricCard label="Running" value={stats.running} color="text-emerald-500" />
        <MetricCard label="Idle" value={stats.idle} color="text-slate-500 dark:text-slate-400" />
        <MetricCard label="Errors" value={stats.errored} color="text-red-500" />
        <MetricCard label="Actions (5m)" value={stats.last5min} color="text-sky-500" />
        <MetricCard label="Total Errors" value={stats.errors} color="text-red-400" />
      </div>

      {/* Activity distribution bar */}
      {recentActionsByCategory.length > 0 ? (
        <div className="glass-panel px-4 py-3">
          <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Activity (Last Hour)
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
            {recentActionsByCategory.map(([cat, count]) => {
              const total = recentActionsByCategory.reduce((s, [, c]) => s + c, 0);
              const pct = Math.max(2, (count / total) * 100);
              const style = ACTION_STYLES[cat as keyof typeof ACTION_STYLES];
              return (
                <div
                  key={cat}
                  className={`${style?.dot ?? "bg-slate-400"} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  title={`${style?.label ?? cat}: ${count}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {recentActionsByCategory.map(([cat, count]) => {
              const style = ACTION_STYLES[cat as keyof typeof ACTION_STYLES];
              return (
                <div key={cat} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${style?.dot ?? "bg-slate-400"}`} />
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {style?.label ?? cat}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Agent Fleet Grid */}
      <div>
        <p className="mb-2 px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Agent Fleet
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedAgents.map((agent) => {
            const avatarSeed = agent.avatarSeed ?? agent.agentId;
            return (
              <button
                key={agent.agentId}
                type="button"
                className="group rounded-md border border-border/70 bg-surface-1 px-3 py-3 text-left transition hover:border-border hover:bg-surface-2"
                onClick={() => onSelectAgent(agent.agentId)}
              >
                <div className="flex items-center gap-3">
                  <AgentAvatar
                    seed={avatarSeed}
                    name={agent.name}
                    avatarUrl={agent.avatarUrl ?? null}
                    size={32}
                    isSelected={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
                        {agent.name}
                      </p>
                      <StatusDot status={agent.status} />
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                      {agent.model ?? "default"} &middot; {formatTimestamp(agent.lastActivityAt)}
                    </p>
                  </div>
                </div>
                {agent.latestPreview ? (
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-foreground/70">
                    {agent.latestPreview}
                  </p>
                ) : null}
                {agent.latestOverrideKind ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        agent.latestOverrideKind === "heartbeat"
                          ? "bg-teal-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                      {agent.latestOverrideKind}
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <div className="rounded-md border border-border/70 bg-surface-1 px-3 py-3">
    <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {label}
    </p>
    <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>
      {value}
    </p>
  </div>
);
