type Hook = 'slack' | 'discord';

async function post(url: string, payload: unknown) {
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export async function notifyImport(opts: {
  ok: boolean;
  meta: { source: string; job: string };
  runId: string;
  inserted?: number;
  error?: string;
}) {
  const { ok, meta, runId, inserted = 0, error } = opts;
  const slack = process.env.SLACK_WEBHOOK_URL;
  const discord = process.env.DISCORD_WEBHOOK_URL;

  const okMsg = `✅ ${meta.source} ${meta.job} (${runId}) inserted=${inserted}`;
  const errMsg = `❌ ${meta.source} ${meta.job} (${runId}) failed: ${error ?? 'unknown'}`;

  if (slack) {
    await post(slack, { text: ok ? okMsg : errMsg });
  }
  if (discord) {
    await post(discord, { content: ok ? okMsg : errMsg });
  }
}
