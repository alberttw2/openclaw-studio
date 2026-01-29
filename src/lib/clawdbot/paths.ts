import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LEGACY_STATE_DIRNAME = ".clawdbot";
const NEW_STATE_DIRNAME = ".moltbot";
const CONFIG_FILENAME = "moltbot.json";

export const resolveUserPath = (
  input: string,
  homedir: () => string = os.homedir
): string => {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
};

export const resolveStateDir = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string => {
  const override = env.MOLTBOT_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override, homedir);
  const legacyDir = path.join(homedir(), LEGACY_STATE_DIRNAME);
  const newDir = path.join(homedir(), NEW_STATE_DIRNAME);
  const hasLegacy = fs.existsSync(legacyDir);
  const hasNew = fs.existsSync(newDir);
  if (!hasLegacy && hasNew) return newDir;
  return legacyDir;
};

export const resolveConfigPathCandidates = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string[] => {
  const explicit = env.MOLTBOT_CONFIG_PATH?.trim() || env.CLAWDBOT_CONFIG_PATH?.trim();
  if (explicit) return [resolveUserPath(explicit, homedir)];

  const candidates: string[] = [];
  const moltbotStateDir = env.MOLTBOT_STATE_DIR?.trim();
  if (moltbotStateDir) {
    const resolved = resolveUserPath(moltbotStateDir, homedir);
    candidates.push(path.join(resolved, CONFIG_FILENAME));
  }
  const clawdbotStateDir = env.CLAWDBOT_STATE_DIR?.trim();
  if (clawdbotStateDir) {
    const resolved = resolveUserPath(clawdbotStateDir, homedir);
    candidates.push(path.join(resolved, CONFIG_FILENAME));
  }

  candidates.push(path.join(homedir(), NEW_STATE_DIRNAME, CONFIG_FILENAME));
  candidates.push(path.join(homedir(), LEGACY_STATE_DIRNAME, CONFIG_FILENAME));
  return candidates;
};

export const resolveClawdbotEnvPath = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string => path.join(resolveStateDir(env, homedir), ".env");
