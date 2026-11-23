import 'server-only';

export async function tfl(path, query = {}) {
  const url = new URL(path, 'https://api.tfl.gov.uk');
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  if (process.env.TFL_APP_KEY) url.searchParams.set('app_key', process.env.TFL_APP_KEY);
  if (process.env.TFL_APP_ID) url.searchParams.set('app_id', process.env.TFL_APP_ID);
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8500),
  });
  return { status: response.status, data: await response.json() };
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

