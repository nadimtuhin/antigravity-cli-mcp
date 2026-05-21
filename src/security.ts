import { realpath } from "fs/promises";
import { resolve, dirname } from "path";
import { AgyPathError } from "./types.js";

export async function validatePath(inputPath: string, workspaceRoot: string): Promise<string> {
  const realRoot = await realpath(workspaceRoot);
  const abs = resolve(realRoot, inputPath);
  
  let current = abs;
  while (true) {
    try {
      const real = await realpath(current);
      if (!real.startsWith(realRoot + "/") && real !== realRoot) {
        throw new AgyPathError(`Path escapes workspace: ${inputPath}`);
      }
      break;
    } catch (e: any) {
      if (e.code === "ENOENT") {
        const parent = dirname(current);
        if (parent === current) {
          throw new AgyPathError(`Path escapes workspace: ${inputPath}`);
        }
        current = parent;
      } else {
        throw e;
      }
    }
  }

  return realpath(abs).catch(() => abs);
}

