import { route } from '@/lib/api';
import { exportAll } from '@/lib/repo/settings';

export const GET = route(async ({ db }) => {
  const data = await exportAll(db);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="ajm-creator-intelligence-${stamp}.json"`,
      'Cache-Control': 'private, no-store'
    }
  });
});
