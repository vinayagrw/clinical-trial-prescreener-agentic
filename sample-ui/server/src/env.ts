import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDir, "..", "..");

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadServerEnv(): void {
  for (const candidate of [".env", ".env.local"]) {
    const filePath = join(projectRoot, candidate);
    try {
      const content = readFileSync(filePath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const parsed = parseLine(line);
        if (!parsed) {
          continue;
        }
        const [key, value] = parsed;
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    } catch {
      // Local env files are optional in the prototype.
    }
  }
}
