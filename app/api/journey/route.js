import { json, tfl } from '../../../lib/tfl';

function choices(result, side) {
  return (result[side + 'LocationDisambiguation']?.disambiguationOptions ?? [])
    .filter(option => option.parameterValue && option.place?.commonName)
    .map(option => ({ value: option.parameterValue, label: option.place.commonName }));
}

function routeLeg(leg) {
  const route = leg.routeOptions?.[0];
  return {
    mode: leg.mode?.id,
    line: route?.lineIdentifier?.id,
    name: route?.name || route?.lineIdentifier?.name,
    towards: route?.directions?.filter(Boolean) ?? [],
    direction: route?.direction,
    summary: leg.instruction?.summary,
    detailed: leg.instruction?.detailed,
    walking: (leg.instruction?.steps ?? []).filter(step => step.description)
      .map(step => [step.descriptionHeading?.trim(), step.description].filter(Boolean).join(' ')),
    from: leg.departurePoint?.commonName,
    to: leg.arrivalPoint?.commonName,
    stopId: leg.departurePoint?.individualStopId || leg.departurePoint?.naptanId,
    stationId: leg.departurePoint?.naptanId,
    stopLetter: leg.departurePoint?.stopLetter,
    platform: leg.departurePoint?.platformName,
    duration: leg.duration,
    departure: leg.departureTime,
    arrival: leg.arrivalTime,
    notices: [...(leg.disruptions ?? []), ...(leg.plannedWorks ?? [])]
      .map(item => item.description ?? item.reason).filter(Boolean),
    disrupted: leg.isDisrupted,
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const from = typeof body?.from === 'string' ? body.from.trim() : '';
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  if ([from, to].some(value => !value || value.length > 300 || /^\.{1,2}$/.test(value) || /[\u0000-\u001f]/.test(value))) {
    return json({ error: 'Enter a starting point and destination.' }, 400);
  }
  try {
    const { status, data } = await tfl(
      '/Journey/JourneyResults/' + encodeURIComponent(from) + '/to/' + encodeURIComponent(to),
    );
    if (status === 300 || data.fromLocationDisambiguation || data.toLocationDisambiguation) {
      const options = { from: choices(data, 'from'), to: choices(data, 'to') };
      if (options.from.length || options.to.length) return json({ options });
    }
    if ([200, 300, 404].includes(status)) {
      const journeys = (data.journeys ?? []).filter(journey => journey.legs?.length)
        .map(journey => ({
          duration: journey.duration,
          start: journey.startDateTime,
          end: journey.arrivalDateTime,
          legs: journey.legs.map(routeLeg),
        }));
      return json({ journeys, notices: (data.stopMessages ?? []).filter(item => typeof item === 'string') });
    }
  } catch {
    // Network and invalid upstream responses share the same recovery path.
  }
  return json({ error: 'Journey information is unavailable. Try again in a moment.' }, 503);
}

