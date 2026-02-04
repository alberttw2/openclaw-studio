import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";

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
  model: null,
  thinkingLevel: null,
  avatarSeed: "seed-1",
  avatarUrl: null,
});

describe("AgentChatPanel controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_agent_settings_control_without_inspect_copy", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        onOpenSettings: vi.fn(),
        onNameChange: vi.fn(async () => true),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onAvatarShuffle: vi.fn(),
        onNameShuffle: vi.fn(),
      })
    );

    expect(screen.getByTestId("agent-settings-toggle")).toBeInTheDocument();
    expect(screen.getByLabelText("Open agent settings")).toBeInTheDocument();
    expect(screen.queryByText("Inspect")).not.toBeInTheDocument();
  });

  it("invokes_on_open_settings_when_control_clicked", () => {
    const onOpenSettings = vi.fn();

    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        onOpenSettings,
        onNameChange: vi.fn(async () => true),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onAvatarShuffle: vi.fn(),
        onNameShuffle: vi.fn(),
      })
    );

    fireEvent.click(screen.getByTestId("agent-settings-toggle"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
