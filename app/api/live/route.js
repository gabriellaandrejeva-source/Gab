import { json, tfl } from '../../../lib/tfl';

async function feed(path) {
  if (!path) return null;
  const { status, data } = await tfl(path);
  return status === 200 && Array.isArray(data) ? data : null;
}

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  const line = query.get('line') ?? '';
  const stop = query.get('stop') ?? '';
  const station = query.get('station') ?? '';
  if (!/^[a-z0-9-]{1,60}$/i.test(line) ||
      [stop, station].some(value => value && !/^[a-z0-9-]{1,60}$/i.test(value))) {
    return json({ error: 'Live information is unavailable.' }, 400);
  }
  const getArrivals = id => feed(id && '/StopPoint/' + id + '/Arrivals').catch(() => null);
  const [atStop, atStation, lines] = await Promise.all([
    getArrivals(stop),
    station !== stop ? getArrivals(station) : null,
    feed('/Line/' + line + '/Status?detail=true').catch(() => null),
  ]);
  const arrivals = atStop || atStation ? [...(atStop ?? []), ...(atStation ?? [])]
    .filter(item => item.lineId === line && Number.isFinite(Date.parse(item.expectedArrival)))
    .map(item => ({
      id: item.id,
      expected: item.expectedArrival,
      expires: item.timeToLive,
      direction: item.direction,
      destination: item.destinationName,
      towards: item.towards,
      platform: item.platformName,
      stopId: item.naptanId,
    })) : null;
  const statuses = lines?.find(item => item.id === line)?.lineStatuses;
  return json({
    arrivals,
    checkedAt: new Date().toISOString(),
    statuses: statuses?.length ? statuses.map(item => ({
      label: item.statusSeverityDescription,
      detail: item.reason || item.disruption?.description,
    })) : null,
  });
}

