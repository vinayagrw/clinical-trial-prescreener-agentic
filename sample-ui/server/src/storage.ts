import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { HandoffRecord, RuntimeStorePayload } from "./types.ts";

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(
  filePath: string,
  payload: unknown,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

export async function readRuntimeStore(filePath: string): Promise<HandoffRecord[]> {
  const parsed = await readJsonFile<RuntimeStorePayload>(filePath);
  return parsed?.handoffs ?? [];
}

export async function writeRuntimeStore(
  filePath: string,
  handoffs: HandoffRecord[],
): Promise<void> {
  const payload: RuntimeStorePayload = {
    updatedAt: new Date().toISOString(),
    handoffs,
  };
  await writeJsonFile(filePath, payload);
}
