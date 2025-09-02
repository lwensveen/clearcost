export function getDailyComputeLimit(plan?: string): number {
  const p = (plan ?? 'free').toLowerCase();
  const limits: Record<string, number> = {
    free: 10,
    starter: 200,
    growth: 2000,
    scale: 10000,
  };

  return limits[p]! ?? limits.free;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
