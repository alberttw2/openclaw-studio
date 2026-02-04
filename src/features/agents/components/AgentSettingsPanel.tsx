"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  resolveHeartbeatSettings,
  updateGatewayHeartbeat,
  type GatewayConfigSnapshot,
} from "@/lib/gateway/agentConfig";
import type { GatewayModelChoice } from "@/lib/gateway/models";

const HEARTBEAT_INTERVAL_OPTIONS = ["15m", "30m", "1h", "2h", "6h", "12h", "24h"];

type AgentSettingsPanelProps = {
  agent: AgentState;
  client: GatewayClient;
  models: GatewayModelChoice[];
  onClose: () => void;
  onDelete: () => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
};

export const AgentSettingsPanel = ({
  agent,
  client,
  models,
  onClose,
  onDelete,
  onModelChange,
  onThinkingChange,
  onToolCallingToggle,
  onThinkingTracesToggle,
}: AgentSettingsPanelProps) => {
  const [heartbeatLoading, setHeartbeatLoading] = useState(false);
  const [heartbeatSaving, setHeartbeatSaving] = useState(false);
  const [heartbeatDirty, setHeartbeatDirty] = useState(false);
  const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
  const [heartbeatOverride, setHeartbeatOverride] = useState(false);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const [heartbeatEvery, setHeartbeatEvery] = useState("30m");
  const [heartbeatIntervalMode, setHeartbeatIntervalMode] = useState<"preset" | "custom">(
    "preset"
  );
  const [heartbeatCustomMinutes, setHeartbeatCustomMinutes] = useState("45");
  const [heartbeatTargetMode, setHeartbeatTargetMode] = useState<"last" | "none" | "custom">(
    "last"
  );
  const [heartbeatTargetCustom, setHeartbeatTargetCustom] = useState("");
  const [heartbeatIncludeReasoning, setHeartbeatIncludeReasoning] = useState(false);
  const [heartbeatActiveHoursEnabled, setHeartbeatActiveHoursEnabled] = useState(false);
  const [heartbeatActiveStart, setHeartbeatActiveStart] = useState("08:00");
  const [heartbeatActiveEnd, setHeartbeatActiveEnd] = useState("18:00");
  const [heartbeatAckMaxChars, setHeartbeatAckMaxChars] = useState("300");

  const loadHeartbeat = useCallback(async () => {
    setHeartbeatLoading(true);
    setHeartbeatError(null);
    try {
      const snapshot = await client.call<GatewayConfigSnapshot>("config.get", {});
      const config =
        snapshot.config && typeof snapshot.config === "object" ? snapshot.config : {};
      const result = resolveHeartbeatSettings(config, agent.agentId);
      const every = result.heartbeat.every ?? "30m";
      const enabled = every !== "0m";
      const isPreset = HEARTBEAT_INTERVAL_OPTIONS.includes(every);
      if (isPreset) {
        setHeartbeatIntervalMode("preset");
      } else {
        setHeartbeatIntervalMode("custom");
        const parsed =
          every.endsWith("m")
            ? Number.parseInt(every, 10)
            : every.endsWith("h")
              ? Number.parseInt(every, 10) * 60
              : Number.parseInt(every, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          setHeartbeatCustomMinutes(String(parsed));
        }
      }
      const target = result.heartbeat.target ?? "last";
      const targetMode = target === "last" || target === "none" ? target : "custom";
      setHeartbeatOverride(result.hasOverride);
      setHeartbeatEnabled(enabled);
      setHeartbeatEvery(enabled ? every : "30m");
      setHeartbeatTargetMode(targetMode);
      setHeartbeatTargetCustom(targetMode === "custom" ? target : "");
      setHeartbeatIncludeReasoning(Boolean(result.heartbeat.includeReasoning));
      if (result.heartbeat.activeHours) {
        setHeartbeatActiveHoursEnabled(true);
        setHeartbeatActiveStart(result.heartbeat.activeHours.start);
        setHeartbeatActiveEnd(result.heartbeat.activeHours.end);
      } else {
        setHeartbeatActiveHoursEnabled(false);
      }
      if (typeof result.heartbeat.ackMaxChars === "number") {
        setHeartbeatAckMaxChars(String(result.heartbeat.ackMaxChars));
      } else {
        setHeartbeatAckMaxChars("300");
      }
      setHeartbeatDirty(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load heartbeat settings.";
      setHeartbeatError(message);
    } finally {
      setHeartbeatLoading(false);
    }
  }, [client, agent.agentId]);

  const saveHeartbeat = useCallback(async () => {
    setHeartbeatSaving(true);
    setHeartbeatError(null);
    try {
      const target =
        heartbeatTargetMode === "custom" ? heartbeatTargetCustom.trim() : heartbeatTargetMode;
      let every = heartbeatEnabled ? heartbeatEvery.trim() : "0m";
      if (heartbeatEnabled && heartbeatIntervalMode === "custom") {
        const customValue = Number.parseInt(heartbeatCustomMinutes, 10);
        if (!Number.isFinite(customValue) || customValue <= 0) {
          setHeartbeatError("Custom interval must be a positive number.");
          setHeartbeatSaving(false);
          return;
        }
        every = `${customValue}m`;
      }
      const ackParsed = Number.parseInt(heartbeatAckMaxChars, 10);
      const ackMaxChars = Number.isFinite(ackParsed) ? ackParsed : 300;
      const activeHours =
        heartbeatActiveHoursEnabled && heartbeatActiveStart && heartbeatActiveEnd
          ? { start: heartbeatActiveStart, end: heartbeatActiveEnd }
          : null;
      const result = await updateGatewayHeartbeat({
        client,
        agentId: agent.agentId,
        sessionKey: agent.sessionKey,
        payload: {
          override: heartbeatOverride,
          heartbeat: {
            every,
            target: target || "last",
            includeReasoning: heartbeatIncludeReasoning,
            ackMaxChars,
            activeHours,
          },
        },
      });
      setHeartbeatOverride(result.hasOverride);
      setHeartbeatEnabled(result.heartbeat.every !== "0m");
      setHeartbeatEvery(result.heartbeat.every);
      setHeartbeatTargetMode(
        result.heartbeat.target === "last" || result.heartbeat.target === "none"
          ? result.heartbeat.target
          : "custom"
      );
      setHeartbeatTargetCustom(
        result.heartbeat.target === "last" || result.heartbeat.target === "none"
          ? ""
          : result.heartbeat.target
      );
      setHeartbeatIncludeReasoning(result.heartbeat.includeReasoning);
      if (result.heartbeat.activeHours) {
        setHeartbeatActiveHoursEnabled(true);
        setHeartbeatActiveStart(result.heartbeat.activeHours.start);
        setHeartbeatActiveEnd(result.heartbeat.activeHours.end);
      } else {
        setHeartbeatActiveHoursEnabled(false);
      }
      if (typeof result.heartbeat.ackMaxChars === "number") {
        setHeartbeatAckMaxChars(String(result.heartbeat.ackMaxChars));
      } else {
        setHeartbeatAckMaxChars("300");
      }
      setHeartbeatDirty(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save heartbeat settings.";
      setHeartbeatError(message);
    } finally {
      setHeartbeatSaving(false);
    }
  }, [
    heartbeatActiveEnd,
    heartbeatActiveHoursEnabled,
    heartbeatActiveStart,
    heartbeatAckMaxChars,
    heartbeatCustomMinutes,
    heartbeatEnabled,
    heartbeatEvery,
    heartbeatIncludeReasoning,
    heartbeatIntervalMode,
    heartbeatOverride,
    heartbeatTargetCustom,
    heartbeatTargetMode,
    client,
    agent.agentId,
    agent.sessionKey,
  ]);

  useEffect(() => {
    void loadHeartbeat();
  }, [loadHeartbeat]);

  const modelOptions = useMemo(
    () =>
      models.map((entry) => ({
        value: `${entry.provider}/${entry.id}`,
        label:
          entry.name === `${entry.provider}/${entry.id}`
            ? entry.name
            : `${entry.name} (${entry.provider}/${entry.id})`,
        reasoning: entry.reasoning,
      })),
    [models]
  );
  const modelValue = agent.model ?? "";
  const modelOptionsWithFallback =
    modelValue && !modelOptions.some((option) => option.value === modelValue)
      ? [{ value: modelValue, label: modelValue, reasoning: undefined }, ...modelOptions]
      : modelOptions;
  const selectedModel = modelOptionsWithFallback.find((option) => option.value === modelValue);
  const allowThinking = selectedModel?.reasoning !== false;

  return (
    <div
      className="agent-inspect-panel"
      data-testid="agent-settings-panel"
      style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
    >
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Agent settings
          </div>
          <div className="console-title text-2xl leading-none text-foreground">{agent.name}</div>
        </div>
        <button
          className="rounded-md border border-border/80 bg-card/70 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:border-border hover:bg-muted/65"
          type="button"
          data-testid="agent-settings-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <section
          className="rounded-md border border-border/80 bg-card/70 p-4"
          data-testid="agent-settings-runtime"
        >
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Runtime settings
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">
            <label className="flex min-w-0 flex-col gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Model</span>
              <select
                className="h-10 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border bg-card/75 px-3 text-xs font-semibold text-foreground"
                value={agent.model ?? ""}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  onModelChange(value ? value : null);
                }}
              >
                {modelOptionsWithFallback.length === 0 ? <option value="">No models found</option> : null}
                {modelOptionsWithFallback.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {allowThinking ? (
              <label className="flex flex-col gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span>Thinking</span>
                <select
                  className="h-10 rounded-md border border-border bg-card/75 px-3 text-xs font-semibold text-foreground"
                  value={agent.thinkingLevel ?? ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    onThinkingChange(value ? value : null);
                  }}
                >
                  <option value="">Default</option>
                  <option value="off">Off</option>
                  <option value="minimal">Minimal</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="xhigh">XHigh</option>
                </select>
              </label>
            ) : (
              <div />
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/75 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Show tool calls</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={agent.toolCallingEnabled}
                onChange={(event) => onToolCallingToggle(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/75 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Show thinking</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={agent.showThinkingTraces}
                onChange={(event) => onThinkingTracesToggle(event.target.checked)}
              />
            </label>
          </div>

          <div className="mt-4 rounded-md border border-border/80 bg-card/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Heartbeat config
              </div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {heartbeatLoading
                  ? "Loading..."
                  : heartbeatDirty
                    ? "Unsaved changes"
                    : "All changes saved"}
              </div>
            </div>
            {heartbeatError ? (
              <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
                {heartbeatError}
              </div>
            ) : null}
            <label className="mt-4 flex items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Override defaults</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={heartbeatOverride}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatOverride(event.target.checked);
                  setHeartbeatDirty(true);
                }}
              />
            </label>
            <label className="mt-4 flex items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Enabled</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={heartbeatEnabled}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatEnabled(event.target.checked);
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
              />
            </label>
            <label className="mt-4 flex flex-col gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Interval</span>
              <select
                className="h-10 rounded-md border border-border bg-card/75 px-3 text-xs font-semibold text-foreground"
                value={heartbeatIntervalMode === "custom" ? "custom" : heartbeatEvery}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "custom") {
                    setHeartbeatIntervalMode("custom");
                  } else {
                    setHeartbeatIntervalMode("preset");
                    setHeartbeatEvery(value);
                  }
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
              >
                {HEARTBEAT_INTERVAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Every {option}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
            {heartbeatIntervalMode === "custom" ? (
              <input
                type="number"
                min={1}
                className="mt-2 h-10 w-full rounded-md border border-border bg-card/75 px-3 text-xs text-foreground outline-none"
                value={heartbeatCustomMinutes}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatCustomMinutes(event.target.value);
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
                placeholder="Minutes"
              />
            ) : null}
            <label className="mt-4 flex flex-col gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Target</span>
              <select
                className="h-10 rounded-md border border-border bg-card/75 px-3 text-xs font-semibold text-foreground"
                value={heartbeatTargetMode}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatTargetMode(event.target.value as "last" | "none" | "custom");
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
              >
                <option value="last">Last channel</option>
                <option value="none">No delivery</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {heartbeatTargetMode === "custom" ? (
              <input
                className="mt-2 h-10 w-full rounded-md border border-border bg-card/75 px-3 text-xs text-foreground outline-none"
                value={heartbeatTargetCustom}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatTargetCustom(event.target.value);
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
                placeholder="Channel id (e.g., whatsapp)"
              />
            ) : null}
            <label className="mt-4 flex items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Include reasoning</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={heartbeatIncludeReasoning}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatIncludeReasoning(event.target.checked);
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
              />
            </label>
            <label className="mt-4 flex items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Active hours</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={heartbeatActiveHoursEnabled}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatActiveHoursEnabled(event.target.checked);
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
              />
            </label>
            {heartbeatActiveHoursEnabled ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  type="time"
                  className="h-10 w-full rounded-md border border-border bg-card/75 px-3 text-xs text-foreground outline-none"
                  value={heartbeatActiveStart}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatActiveStart(event.target.value);
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                />
                <input
                  type="time"
                  className="h-10 w-full rounded-md border border-border bg-card/75 px-3 text-xs text-foreground outline-none"
                  value={heartbeatActiveEnd}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatActiveEnd(event.target.value);
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                />
              </div>
            ) : null}
            <label className="mt-4 flex flex-col gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>ACK max chars</span>
              <input
                type="number"
                min={0}
                className="h-10 w-full rounded-md border border-border bg-card/75 px-3 text-xs text-foreground outline-none"
                value={heartbeatAckMaxChars}
                disabled={heartbeatLoading || heartbeatSaving}
                onChange={(event) => {
                  setHeartbeatAckMaxChars(event.target.value);
                  setHeartbeatOverride(true);
                  setHeartbeatDirty(true);
                }}
              />
            </label>
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {heartbeatDirty ? "Remember to save changes." : "Up to date."}
              </div>
              <button
                className="rounded-md border border-transparent bg-primary/90 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                type="button"
                disabled={heartbeatLoading || heartbeatSaving || !heartbeatDirty}
                onClick={() => void saveHeartbeat()}
              >
                {heartbeatSaving ? "Saving..." : "Save heartbeat"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-destructive/30 bg-destructive/4 p-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
            Delete agent
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Removes the agent from the gateway config.
          </div>
          <button
            className="mt-3 w-full rounded-md border border-destructive/50 bg-transparent px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive shadow-sm transition hover:bg-destructive/10"
            type="button"
            onClick={onDelete}
          >
            Delete agent
          </button>
        </section>
      </div>
    </div>
  );
};
