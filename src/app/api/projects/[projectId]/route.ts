import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  loadClawdbotConfig,
  removeAgentEntry,
  saveClawdbotConfig,
} from "@/lib/clawdbot/config";
import { deleteAgentArtifacts } from "@/lib/projects/fs.server";
import { loadStore, saveStore } from "../store";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const trimmedProjectId = projectId.trim();
    if (!trimmedProjectId) {
      return NextResponse.json({ error: "Workspace id is required." }, { status: 400 });
    }
    const store = loadStore();
    const project = store.projects.find((entry) => entry.id === trimmedProjectId);
    if (!project) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

    const warnings: string[] = [];
    let configInfo: { config: Record<string, unknown>; configPath: string } | null = null;
    try {
      configInfo = loadClawdbotConfig();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update clawdbot.json.";
      warnings.push(`Agent config not updated: ${message}`);
    }
    for (const tile of project.tiles) {
      if (!tile.agentId?.trim()) {
        warnings.push(`Missing agentId for tile ${tile.id}; skipped agent cleanup.`);
        continue;
      }
      deleteAgentArtifacts(trimmedProjectId, tile.agentId, warnings);
      if (configInfo) {
        removeAgentEntry(configInfo.config, tile.agentId);
      }
    }
    if (configInfo) {
      saveClawdbotConfig(configInfo.configPath, configInfo.config);
    }

    const projects = store.projects.filter((project) => project.id !== trimmedProjectId);
    const activeProjectId =
      store.activeProjectId === trimmedProjectId
        ? projects[0]?.id ?? null
        : store.activeProjectId;
    const nextStore = {
      version: 2 as const,
      activeProjectId,
      projects,
    };
    saveStore(nextStore);
    return NextResponse.json({ store: nextStore, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete workspace.";
    logger.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
