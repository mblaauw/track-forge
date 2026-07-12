const controllers = new Map<string, AbortController>();

export function createAbortController(jobId: string): AbortController {
  const existing = controllers.get(jobId);
  if (existing && !existing.signal.aborted) {
    return existing;
  }
  const controller = new AbortController();
  controllers.set(jobId, controller);
  return controller;
}

export function abortJob(jobId: string): boolean {
  const controller = controllers.get(jobId);
  if (controller && !controller.signal.aborted) {
    controller.abort();
    controllers.delete(jobId);
    return true;
  }
  return false;
}

export function getJobSignal(jobId: string): AbortSignal | undefined {
  const controller = controllers.get(jobId);
  return controller?.signal;
}

export function hasActiveJob(jobId: string): boolean {
  const controller = controllers.get(jobId);
  return !!controller && !controller.signal.aborted;
}

export function cleanupJob(jobId: string): void {
  controllers.delete(jobId);
}
