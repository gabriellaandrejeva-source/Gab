export const modes = {
  walking: 'Walk', bus: 'Bus', tube: 'Tube', dlr: 'DLR', tram: 'Tram',
  overground: 'Overground', 'elizabeth-line': 'Elizabeth line', 'national-rail': 'Train',
  'river-bus': 'River bus', 'cable-car': 'Cable car', coach: 'Coach',
};

export function journeySteps(journey) {
  return journey.legs.flatMap(leg => {
    const { mode, from, to, name, detailed, summary } = leg;
    if (mode === 'walking') {
      return (leg.walking.length ? leg.walking : [summary || (to && 'Walk to ' + to)])
        .map(title => ({
          kind: 'walk', title: title || 'Walking directions unavailable',
          detail: to && leg.walking.length ? 'Walking to ' + to : '', leg,
        }));
    }
    const service = mode === 'bus' && name ? 'bus ' + name : mode === 'tube' && name ? name + ' line' : name || modes[mode];
    return [
      {
        kind: 'board', leg,
        title: service ? 'Board the ' + service : summary || 'Boarding details unavailable',
        detail: [detailed || summary, from && 'Board at ' + from, leg.stopLetter && 'Stop ' + leg.stopLetter,
          !leg.stopLetter && leg.platform && 'Platform ' + leg.platform].filter(Boolean).join('. '),
      },
      {
        kind: 'exit', leg,
        title: to ? 'Get off at ' + to : summary || 'Where to get off is unavailable',
        detail: service && 'Stay on the ' + service + ' until this stop.',
      },
    ];
  });
}

export function planTime(value) {
  if (!value) return '';
  // Journey Planner supplies London wall-clock times without an offset.
  if (/T\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(value)) return value.split('T')[1].slice(0, 5);
  return liveTime(value);
}

export function liveTime(value) {
  if (!Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function normalize(value) {
  return value?.toLowerCase().replace(/\b(underground|railway|rail|dlr|overground|station)\b/g, '')
    .replace(/[^a-z0-9]/g, '') || '';
}

export function matchingArrivals(arrivals, leg, now) {
  const terminalNames = value => (leg.mode === 'bus' ? [value, value?.split('/')[0]] : [value]).map(normalize);
  const directions = leg.towards.flatMap(terminalNames).filter(Boolean);
  const seen = new Set();
  return (arrivals ?? []).filter(item => {
    if (!Number.isFinite(Date.parse(item.expected)) || Date.parse(item.expected) < now || (item.expires && Date.parse(item.expires) < now)) return false;
    if (!directions.some(direction => [item.destination, item.towards].flatMap(terminalNames).includes(direction))) return false;
    if (item.direction && leg.direction && item.direction.toLowerCase() !== leg.direction.toLowerCase()) return false;
    if (leg.stopLetter && item.stopId !== leg.stopId &&
        item.platform?.replace(/^stop\s+/i, '').toLowerCase() !== leg.stopLetter.toLowerCase()) return false;
    const key = item.id || item.expected + item.platform;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => Date.parse(a.expected) - Date.parse(b.expected)).slice(0, 3);
}

