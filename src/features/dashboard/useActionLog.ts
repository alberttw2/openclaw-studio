"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import { type ActionEntry, classifyAgentAction } from "./types";

const MAX_LOG_SIZE = 500;

/**
 * Derives action entries from agent state transitions.
 * Watches agent status changes, new output lines, and activity timestamps
 * to build a running log of colour-coded actions.
 */
export const useActionLog = (agents: AgentState[]) => {
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const prevSnapshotRef = useRef<Map<string, AgentState>>(new Map());

  const pushAction = useCallback((entry: ActionEntry) => {
    setActions((prev) => {
      const next = [entry, ...prev];
      return next.length > MAX_LOG_SIZE ? next.slice(0, MAX_LOG_SIZE) : next;
    });
  }, []);

  useEffect(() => {
    const prev = prevSnapshotRef.current;
    const next = new Map(agents.map((a) => [a.agentId, a]));

    for (const agent of agents) {
      const old = prev.get(agent.agentId);

      // New agent appeared
      if (!old) {
        pushAction(
          classifyAgentAction(
            agent.agentId,
            agent.name,
            "agent-create",
            `Agent "${agent.name}" appeared in fleet`
          )
        );
        continue;
      }

      // Status transitions
      if (old.status !== agent.status) {
        if (agent.status === "running" && old.status === "idle") {
          pushAction(
            classifyAgentAction(
              agent.agentId,
              agent.name,
              "run-start",
              `Agent started running`
            )
          );
        } else if (agent.status === "idle" && old.status === "running") {
          pushAction(
            classifyAgentAction(
              agent.agentId,
              agent.name,
              "run-end",
              `Agent finished run`
            )
          );
        } else if (agent.status === "error") {
          pushAction(
            classifyAgentAction(
              agent.agentId,
              agent.name,
              "error",
              `Agent entered error state`
            )
          );
        }
      }

      // New output lines (chat / tool calls)
      if (agent.outputLines.length > old.outputLines.length) {
        const newLines = agent.outputLines.slice(old.outputLines.length);
        for (const line of newLines.slice(-3)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const isToolCall =
            trimmed.startsWith("tool:") ||
            trimmed.startsWith("Tool call:") ||
            trimmed.includes("```") ||
            trimmed.startsWith("[tool");
          const eventType = isToolCall ? "tool-call" : "chat";
          pushAction(
            classifyAgentAction(agent.agentId, agent.name, eventType, trimmed.slice(0, 200))
          );
        }
      }

      // Heartbeat override changed
      if (agent.latestOverrideKind !== old.latestOverrideKind) {
        if (agent.latestOverrideKind === "heartbeat") {
          pushAction(
            classifyAgentAction(
              agent.agentId,
              agent.name,
              "heartbeat",
              "Heartbeat check completed"
            )
          );
        } else if (agent.latestOverrideKind === "cron") {
          pushAction(
            classifyAgentAction(
              agent.agentId,
              agent.name,
              "cron",
              "Cron job executed"
            )
          );
        }
      }

      // Session was reset
      if (
        agent.historyLoadedAt !== old.historyLoadedAt &&
        agent.outputLines.length === 0 &&
        old.outputLines.length > 0
      ) {
        pushAction(
          classifyAgentAction(
            agent.agentId,
            agent.name,
            "session-reset",
            "Session was reset"
          )
        );
      }

      // Model/thinking changes
      if (agent.model !== old.model && old.model !== null) {
        pushAction(
          classifyAgentAction(
            agent.agentId,
            agent.name,
            "settings-change",
            `Model changed to ${agent.model ?? "default"}`
          )
        );
      }
    }

    // Detect deleted agents
    for (const [oldId, oldAgent] of prev) {
      if (!next.has(oldId)) {
        pushAction(
          classifyAgentAction(
            oldId,
            oldAgent.name,
            "agent-delete",
            `Agent "${oldAgent.name}" was removed`
          )
        );
      }
    }

    prevSnapshotRef.current = next;
  }, [agents, pushAction]);

  const clearActions = useCallback(() => {
    setActions([]);
  }, []);

  return { actions, clearActions };
};
