type SendNotification = (notification: unknown) => Promise<void>;
type ProgressToken = string | number;
type ChunkEmitter = (chunk: string) => Promise<void>;

export function makeProgressEmitter(
  progressToken: ProgressToken | undefined,
  sendNotification: SendNotification
): ChunkEmitter | null {
  if (progressToken === undefined) {
    return null;
  }

  let progress = 0;

  return async function emitChunk(chunk: string): Promise<void> {
    progress++;
    try {
      await sendNotification({
        method: "notifications/progress",
        params: {
          progressToken,
          progress,
          message: chunk,
        },
      });
    } catch {
      // swallow — progress notifications are best-effort
    }
  };
}
