import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentSettingsPanel } from "@/features/agents/components/AgentSettingsPanel";

const createAgent = (): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:studio:test-session",
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: "seed-1",
  avatarUrl: null,
});

describe("AgentSettingsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_runtime_controls_without_brain_files_section", async () => {
    const call = vi.fn(async () => ({ config: {} }));

    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        client: { call } as never,
        models: [{ provider: "openai", id: "gpt-5", name: "gpt-5", reasoning: true }],
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
      })
    );

    expect(screen.getByText("Runtime settings")).toBeInTheDocument();
    expect(screen.queryByText("Brain files")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(call).toHaveBeenCalledWith("config.get", {});
    });
  });

  it("shows_heartbeat_controls_and_model_select", () => {
    const call = vi.fn(async () => ({ config: {} }));

    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        client: { call } as never,
        models: [{ provider: "openai", id: "gpt-5", name: "gpt-5", reasoning: true }],
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
      })
    );

    expect(screen.getByText("Heartbeat config")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
  });
});
