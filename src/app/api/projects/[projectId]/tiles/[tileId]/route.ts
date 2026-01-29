import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import type { ProjectTileUpdatePayload } from "@/lib/projects/types";
import { deleteAgentArtifacts } from "@/lib/projects/fs.server";
import {
  loadClawdbotConfig,
  removeAgentEntry,
  saveClawdbotConfig,
  upsertAgentEntry,
} from "@/lib/clawdbot/config";
import { loadStore, saveStore } from "../../../store";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; tileId: string }> }
) {
  try {
    const { projectId, tileId } = await context.params;
    const trimmedProjectId = projectId.trim();
    const trimmedTileId = tileId.trim();
    if (!trimmedProjectId || !trimmedTileId) {
      return NextResponse.json(
        { error: "Workspace id and tile id are required." },
        { status: 400 }
      );
    }
    const store = loadStore();
    const project = store.projects.find((entry) => entry.id === trimmedProjectId);
    if (!project) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }
    const tile = project.tiles.find((entry) => entry.id === trimmedTileId);
    if (!tile) {
      return NextResponse.json({ error: "Tile not found." }, { status: 404 });
    }

    const warnings: string[] = [];
    if (!tile.agentId?.trim()) {
      warnings.push(`Missing agentId for tile ${tile.id}; skipped agent cleanup.`);
    } else {
      deleteAgentArtifacts(trimmedProjectId, tile.agentId, warnings);
      try {
        const { config, configPath } = loadClawdbotConfig();
        const changed = removeAgentEntry(config, tile.agentId);
        if (changed) {
          saveClawdbotConfig(configPath, config);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update clawdbot.json.";
        warnings.push(`Agent config not updated: ${message}`);
      }
    }

    const nextTiles = project.tiles.filter((entry) => entry.id !== trimmedTileId);
    if (nextTiles.length === project.tiles.length) {
      return NextResponse.json({ error: "Tile not found." }, { status: 404 });
    }
    const nextStore = {
      ...store,
      version: 2 as const,
      projects: store.projects.map((entry) =>
        entry.id === trimmedProjectId
          ? { ...entry, tiles: nextTiles, updatedAt: Date.now() }
          : entry
      ),
    };
    saveStore(nextStore);
    return NextResponse.json({ store: nextStore, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete tile.";
    logger.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; tileId: string }> }
) {
  try {
    const { projectId, tileId } = await context.params;
    const trimmedProjectId = projectId.trim();
    const trimmedTileId = tileId.trim();
    if (!trimmedProjectId || !trimmedTileId) {
      return NextResponse.json(
        { error: "Workspace id and tile id are required." },
        { status: 400 }
      );
    }
    const body = (await request.json()) as ProjectTileUpdatePayload;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const avatarSeed =
      typeof body?.avatarSeed === "string" ? body.avatarSeed.trim() : "";
    if (!name && !avatarSeed) {
      return NextResponse.json(
        { error: "Tile update requires a name or avatar seed." },
        { status: 400 }
      );
    }
    if (body?.avatarSeed !== undefined && !avatarSeed) {
      return NextResponse.json({ error: "Avatar seed is invalid." }, { status: 400 });
    }

    const store = loadStore();
    const project = store.projects.find((entry) => entry.id === trimmedProjectId);
    if (!project) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }
    const tile = project.tiles.find((entry) => entry.id === trimmedTileId);
    if (!tile) {
      return NextResponse.json({ error: "Tile not found." }, { status: 404 });
    }

    const warnings: string[] = [];
    if (name) {
      const nextWorkspaceDir = resolveAgentWorkspaceDir(trimmedProjectId, tile.agentId);
      try {
        const { config, configPath } = loadClawdbotConfig();
        const changed = upsertAgentEntry(config, {
          agentId: tile.agentId,
          agentName: name,
          workspaceDir: nextWorkspaceDir,
        });
        if (changed) {
          saveClawdbotConfig(configPath, config);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update clawdbot.json.";
        warnings.push(`Agent config not updated: ${message}`);
      }
    }

    const nextTiles = project.tiles.map((entry) =>
      entry.id === trimmedTileId
        ? {
            ...entry,
            name: name || entry.name,
            avatarSeed: avatarSeed || entry.avatarSeed,
          }
        : entry
    );
    const nextStore = {
      ...store,
      version: 2 as const,
      projects: store.projects.map((entry) =>
        entry.id === trimmedProjectId
          ? { ...entry, tiles: nextTiles, updatedAt: Date.now() }
          : entry
      ),
    };
    saveStore(nextStore);
    return NextResponse.json({ store: nextStore, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to rename tile.";
    logger.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
