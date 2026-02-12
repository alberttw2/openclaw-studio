"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AgentStoreProvider,
  useAgentStore,
  getFilteredAgents,
} from "@/features/agents/state/store";
import { useGatewayConnection } from "@/lib/gateway/GatewayClient";
import {
  isGatewayDisconnectLikeError,
  type EventFrame,
} from "@/lib/gateway/GatewayClient";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import {
  buildSummarySnapshotPatches,
  type SummaryPreviewSnapshot,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import { hydrateAgentFleetFromGateway } from "@/features/agents/operations/agentFleetHydration";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { createRafBatcher } from "@/lib/dom";
import type { AgentState } from "@/features/agents/state/store";
import type {
  GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";

import { DashboardOverview } from "@/features/dashboard/components/DashboardOverview";
import { ActivityFeed } from "@/features/dashboard/components/ActivityFeed";
import { TaskManager } from "@/features/dashboard/components/TaskManager";
import { useActionLog } from "@/features/dashboard/useActionLog";
import type { TaskItem } from "@/features/dashboard/types";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { LayoutDashboard, ArrowLeft } from "lucide-react";

type DashboardTab = "overview" | "activity" | "tasks";

const TABS: Array<{ value: DashboardTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity Feed" },
  { value: "tasks", label: "Task Board" },
];

const DashboardInner = () => {
  const router = useRouter();
  const [settingsCoordinator] = useState(() => createStudioSettingsCoordinator());
  const {
    client,
    status,
    gatewayUrl,
    token,
    localGatewayDefaults,
    error: gatewayError,
    connect,
    setGatewayUrl,
    setToken,
    useLocalGatewayDefaults,
  } = useGatewayConnection(settingsCoordinator);

  const { state, dispatch, hydrateAgents, setError, setLoading } = useAgentStore();
  const [agentsLoadedOnce, setAgentsLoadedOnce] = useState(false);
  const [didAttemptConnect, setDidAttemptConnect] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("openclaw-dashboard-tasks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const stateRef = useRef(state);
  const [gatewayConfigSnapshot, setGatewayConfigSnapshot] =
    useState<GatewayModelPolicySnapshot | null>(null);
  const pendingLivePatchesRef = useRef<Map<string, Partial<AgentState>>>(new Map());
  const flushLivePatchesRef = useRef<() => void>(() => {});
  const livePatchBatcherRef = useRef(createRafBatcher(() => flushLivePatchesRef.current()));
  const runtimeEventHandlerRef = useRef<ReturnType<typeof createGatewayRuntimeEventHandler> | null>(null);

  const agents = state.agents;
  const allAgents = useMemo(() => getFilteredAgents(state, "all"), [state]);
  const { actions } = useActionLog(agents);

  // Persist tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("openclaw-dashboard-tasks", JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const flushPendingLivePatches = useCallback(() => {
    const pending = pendingLivePatchesRef.current;
    if (pending.size === 0) return;
    const entries = [...pending.entries()];
    pending.clear();
    for (const [agentId, patch] of entries) {
      dispatch({ type: "updateAgent", agentId, patch });
    }
  }, [dispatch]);

  useEffect(() => {
    flushLivePatchesRef.current = flushPendingLivePatches;
  }, [flushPendingLivePatches]);

  const queueLivePatch = useCallback((agentId: string, patch: Partial<AgentState>) => {
    const key = agentId.trim();
    if (!key) return;
    const existing = pendingLivePatchesRef.current.get(key);
    pendingLivePatchesRef.current.set(key, existing ? { ...existing, ...patch } : patch);
    livePatchBatcherRef.current.schedule();
  }, []);

  const clearPendingLivePatch = useCallback((agentId: string) => {
    const key = agentId.trim();
    if (!key) return;
    pendingLivePatchesRef.current.delete(key);
    if (pendingLivePatchesRef.current.size === 0) {
      livePatchBatcherRef.current.cancel();
    }
  }, []);

  const loadSummarySnapshot = useCallback(async () => {
    const activeAgents = stateRef.current.agents.filter((a) => a.sessionCreated);
    const sessionKeys = Array.from(
      new Set(
        activeAgents
          .map((a) => a.sessionKey)
          .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      )
    ).slice(0, 64);
    if (sessionKeys.length === 0) return;
    try {
      const [statusSummary, previewResult] = await Promise.all([
        client.call<SummaryStatusSnapshot>("status", {}),
        client.call<SummaryPreviewSnapshot>("sessions.preview", {
          keys: sessionKeys,
          limit: 8,
          maxChars: 240,
        }),
      ]);
      for (const entry of buildSummarySnapshotPatches({
        agents: activeAgents,
        statusSummary,
        previewResult,
      })) {
        dispatch({ type: "updateAgent", agentId: entry.agentId, patch: entry.patch });
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to load summary snapshot.", err);
      }
    }
  }, [client, dispatch]);

  const loadAgentHistory = useCallback(
    async (agentId: string) => {
      // Minimal history load for dashboard — just trigger a summary refresh
      void loadSummarySnapshot();
    },
    [loadSummarySnapshot]
  );

  const loadAgents = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    try {
      const result = await hydrateAgentFleetFromGateway({
        client,
        gatewayUrl,
        cachedConfigSnapshot: gatewayConfigSnapshot,
        loadStudioSettings: () => settingsCoordinator.loadSettings(),
        isDisconnectLikeError: isGatewayDisconnectLikeError,
        logError: (message, error) => console.error(message, error),
      });
      if (!gatewayConfigSnapshot && result.configSnapshot) {
        setGatewayConfigSnapshot(result.configSnapshot);
      }
      hydrateAgents(result.seeds);
      for (const agentId of result.sessionCreatedAgentIds) {
        dispatch({
          type: "updateAgent",
          agentId,
          patch: { sessionCreated: true, sessionSettingsSynced: true },
        });
      }
      for (const entry of result.summaryPatches) {
        dispatch({ type: "updateAgent", agentId: entry.agentId, patch: entry.patch });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load agents.";
      setError(message);
    } finally {
      setLoading(false);
      setAgentsLoadedOnce(true);
    }
  }, [client, dispatch, gatewayConfigSnapshot, gatewayUrl, hydrateAgents, setError, setLoading, settingsCoordinator, status]);

  // Setup event handler
  useEffect(() => {
    const handler = createGatewayRuntimeEventHandler({
      getStatus: () => status,
      getAgents: () => stateRef.current.agents,
      dispatch,
      queueLivePatch,
      clearPendingLivePatch,
      loadSummarySnapshot,
      loadAgentHistory,
      refreshHeartbeatLatestUpdate: () => {},
      bumpHeartbeatTick: () => {},
      setTimeout: (fn, delayMs) => window.setTimeout(fn, delayMs),
      clearTimeout: (id) => window.clearTimeout(id),
      isDisconnectLikeError: isGatewayDisconnectLikeError,
      logWarn: (message, meta) => console.warn(message, meta),
      updateSpecialLatestUpdate: () => {},
    });
    runtimeEventHandlerRef.current = handler;
    const unsubscribe = client.onEvent((event: EventFrame) => handler.handleEvent(event));
    return () => {
      runtimeEventHandlerRef.current = null;
      handler.dispose();
      unsubscribe();
    };
  }, [client, clearPendingLivePatch, dispatch, loadAgentHistory, loadSummarySnapshot, queueLivePatch, status]);

  // Load agents on connect
  useEffect(() => {
    if (status !== "connected") return;
    void loadAgents();
  }, [loadAgents, status]);

  // Summary polling
  useEffect(() => {
    if (status !== "connected") return;
    void loadSummarySnapshot();
    const timer = window.setInterval(() => void loadSummarySnapshot(), 5000);
    return () => window.clearInterval(timer);
  }, [loadSummarySnapshot, status]);

  useEffect(() => {
    if (status === "connecting") setDidAttemptConnect(true);
  }, [status]);

  useEffect(() => {
    if (gatewayError) setDidAttemptConnect(true);
  }, [gatewayError]);

  // Cleanup
  useEffect(() => {
    const batcher = livePatchBatcherRef.current;
    const pending = pendingLivePatchesRef.current;
    return () => {
      batcher.cancel();
      pending.clear();
    };
  }, []);

  const handleSelectAgent = useCallback(
    (agentId: string) => {
      dispatch({ type: "selectAgent", agentId });
      router.push("/");
    },
    [dispatch, router]
  );

  // Gateway connect screen
  if (status === "disconnected" && !agentsLoadedOnce && didAttemptConnect) {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden bg-background">
        <div className="relative z-10 flex h-screen flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
          <DashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />
          <GatewayConnectScreen
            gatewayUrl={gatewayUrl}
            token={token}
            localGatewayDefaults={localGatewayDefaults}
            status={status}
            error={gatewayError}
            onGatewayUrlChange={setGatewayUrl}
            onTokenChange={setToken}
            onUseLocalDefaults={useLocalGatewayDefaults}
            onConnect={() => void connect()}
          />
        </div>
      </div>
    );
  }

  // Loading state
  if (!agentsLoadedOnce && (status === "connecting" || !didAttemptConnect)) {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden bg-background">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="glass-panel w-full max-w-md px-6 py-6 text-center">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              OpenClaw Dashboard
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {status === "connecting" ? "Connecting to gateway..." : "Booting Dashboard..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      <div className="relative z-10 flex h-screen flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5">
        <DashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />

        {state.error ? (
          <div className="w-full">
            <div className="rounded-md border border-destructive bg-destructive px-4 py-2 text-sm text-destructive-foreground">
              {state.error}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {activeTab === "overview" ? (
            <DashboardOverview
              agents={allAgents}
              actions={actions}
              onSelectAgent={handleSelectAgent}
            />
          ) : activeTab === "activity" ? (
            <ActivityFeed actions={actions} maxVisible={100} />
          ) : (
            <TaskManager
              agents={allAgents}
              tasks={tasks}
              onTasksChange={setTasks}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardHeader = ({
  activeTab,
  onTabChange,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}) => {
  const router = useRouter();
  return (
    <div className="glass-panel fade-up relative z-[180] px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-input/80 bg-surface-3 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition hover:border-border hover:bg-surface-2 hover:text-foreground"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-3 w-3" />
            Studio
          </button>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <p className="console-title text-2xl leading-none text-foreground sm:text-3xl">
              Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {TABS.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                className={`rounded-md border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                  active
                    ? "border-border bg-surface-2 text-foreground"
                    : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-surface-2"
                }`}
                onClick={() => onTabChange(tab.value)}
              >
                {tab.label}
              </button>
            );
          })}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  return (
    <AgentStoreProvider>
      <DashboardInner />
    </AgentStoreProvider>
  );
}
