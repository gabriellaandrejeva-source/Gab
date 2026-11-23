'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp, ArrowLeft, ArrowRight, BusFront, Check, ChevronRight, CircleHelp,
  Footprints, LocateFixed, MapPin, Navigation, Route, TrainFront, Volume2,
} from 'lucide-react';
import { journeySteps, liveTime, matchingArrivals, modes, planTime } from '../lib/steps';

const empty = { from: '', to: '' };
const fieldNames = { from: 'Starting point', to: 'Destination' };
const tubeColours = {
  bakerloo: '#894e24', central: '#dc241f', circle: '#d6a800', district: '#007d32',
  'hammersmith-city': '#c46c87', jubilee: '#69767e', metropolitan: '#751056',
  northern: '#242424', piccadilly: '#0019a8', victoria: '#007bad',
  'waterloo-city': '#36866e',
};

function Vehicle({ mode, size = 22 }) {
  const Icon = mode === 'walking' ? Footprints : mode === 'bus' || mode === 'coach' ? BusFront : TrainFront;
  return <Icon size={size} aria-hidden="true" />;
}

function RouteDiagram({ journey }) {
  return <ol className="diagram">{journey.legs.map((leg, index) => <li key={index}>
    <span className="diagram-icon"><Vehicle mode={leg.mode} size={19} /></span>
    <div><strong>{leg.name || modes[leg.mode] || 'Journey stage'}</strong>
      <span>{[leg.from, leg.to].filter(Boolean).join(' → ') || 'Stop details unavailable'}</span>
      {leg.notices.map((notice, i) => <span className="notice" key={i}>{notice}</span>)}
    </div>
  </li>)}</ol>;
}

function LiveDetails({ step }) {
  const { leg, kind } = step;
  const { line, stopId, stationId } = leg;
  const key = [line, stopId, stationId].join('/');
  const [live, setLive] = useState(null);
  useEffect(() => {
    if (!line || kind === 'walk') return;
    let active = true;
    let controller;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const params = new URLSearchParams({ line, stop: stopId || '', station: stationId || '' });
        const response = await fetch('/api/live?' + params, { signal, cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (active && !signal.aborted) setLive({ key, data, now: Date.now() });
      } catch {
        if (active && !signal.aborted) setLive({ key, data: null, now: Date.now() });
      }
    }
    refresh();
    const timer = setInterval(refresh, 25000);
    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
    };
  }, [key, kind, line, stopId, stationId]);

  if (kind === 'walk') return null;
  const current = live?.key === key ? live : null;
  const predictions = matchingArrivals(current?.data?.arrivals, leg, current?.now);
  const statuses = current?.data?.statuses ?? [];
  const routeNotices = leg.notices.filter(notice => !statuses.some(status =>
    status.detail?.trim() === notice.trim()));
  return <div className="live-panel">
    <h3><span className="live-dot" /> Live TfL updates</h3>
    {kind === 'board' && <p>{predictions.length
      ? 'Predicted arrivals at this stop: ' + predictions.map(item => liveTime(item.expected)).join(', ')
      : line && !current ? 'Checking predicted arrivals…' : 'Predicted arrivals for this service are unavailable.'}</p>}
    {statuses.length
      ? statuses.map((status, index) => <p key={index}>{status.label}{status.detail && ' · ' + status.detail}</p>)
      : <p>{line && !current ? 'Checking service status…' : 'Live service status is unavailable.'}</p>}
    {routeNotices.map((notice, index) => <p key={index}>{notice}</p>)}
    {leg.disrupted && !leg.notices.length && <p>TfL flagged a disruption on this stage.</p>}
    {current?.data?.checkedAt && <p className="checked">Checked at {liveTime(current.data.checkedAt)} London time</p>}
  </div>;
}

export default function Planner() {
  const [places, setPlaces] = useState(empty);
  const [values, setValues] = useState(empty);
  const [options, setOptions] = useState(null);
  const [journeys, setJourneys] = useState(null);
  const [notices, setNotices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [otherRoutes, setOtherRoutes] = useState(false);
  const [preview, setPreview] = useState(null);
  const [picks, setPicks] = useState(empty);
  const focus = useRef(null);
  const previewTitle = useRef(null);
  const nearbyInput = useRef(null);

  const steps = selected ? journeySteps(selected) : [];
  const step = steps[index];
  useEffect(() => { setSpeechSupported('speechSynthesis' in window); }, []);
  useEffect(() => {
    if (selected || journeys || options) focus.current?.focus();
    return () => window.speechSynthesis?.cancel();
  }, [selected, journeys, options, index]);
  useEffect(() => { if (preview && !selected) previewTitle.current?.focus(); }, [preview, selected]);
  useEffect(() => { if (nearby) nearbyInput.current?.focus(); }, [nearby]);

  function change(side, value) {
    setPlaces(old => ({ ...old, [side]: value }));
    setValues(old => ({ ...old, [side]: '' }));
    setOptions(null);
    setJourneys(null);
    setPreview(null);
  }

  function swap() {
    setPlaces({ from: places.to, to: places.from });
    setValues({ from: values.to, to: values.from });
    setOptions(null);
    setJourneys(null);
    setPreview(null);
  }

  async function find(from = values.from || places.from, to = values.to || places.to, recovering = false) {
    setBusy('Finding journeys…');
    setError('');
    try {
      const response = await fetch('/api/journey', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (recovering && !data.options && !data.journeys?.length) {
        setNearby(true);
        setError('TfL found no journey from your current location. You can try again or enter a nearby stop.');
        return;
      }
      if (recovering) {
        setPlaces(old => ({ ...old, from: 'My current location' }));
        setValues(old => ({ ...old, from }));
      }
      setSelected(null);
      setIndex(0);
      setOptions(data.options || null);
      setPicks(empty);
      setOtherRoutes(false);
      setPreview(null);
      setJourneys(data.journeys ?? null);
      setNotices(data.notices ?? []);
    } catch (failure) {
      if (recovering) setNearby(true);
      setError(failure.message?.startsWith('Journey information') || failure.message?.startsWith('Enter a')
        ? failure.message : 'Journey information is unavailable. Try again in a moment.');
    } finally {
      setBusy('');
    }
  }

  function missedStop() {
    setError('');
    setReplanning(true);
    setNearby(false);
    setReading(false);
    window.speechSynthesis?.cancel();
    if (!navigator.geolocation) {
      setNearby(true);
      setError('Your location is unavailable. You can enter a nearby stop.');
      return;
    }
    setBusy('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => find(String(coords.latitude) + ',' + String(coords.longitude), values.to || places.to, true),
      () => {
        setBusy('');
        setNearby(true);
        setError('Your location is unavailable. Enter a nearby stop to keep going.');
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
    );
  }

  function read() {
    const speech = window.speechSynthesis;
    speech.cancel();
    if (reading) {
      setReading(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance([step.title, step.detail].filter(Boolean).join('. '));
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    utterance.onend = utterance.onerror = () => setReading(false);
    setReading(true);
    speech.speak(utterance);
  }

  function advance(next) {
    setReading(false);
    setError('');
    setIndex(next);
  }

  function reset() {
    setSelected(null);
    setJourneys(null);
    setOptions(null);
    setError('');
    setIndex(0);
    setReplanning(false);
    setNearby(false);
    setPlaces(empty);
    setValues(empty);
    setPreview(null);
    setReading(false);
  }

  return <>
    <header className="top"><div className="top-inner">
      <div className="brand"><span className="brand-icon"><Route size={25} aria-hidden="true" /></span> Pocket Buddy</div>
      <span className="top-label">London travel companion</span>
    </div></header>
    <main>
      {!selected && <div className="intro">
        <div className="intro-art" aria-hidden="true"><span className="intro-icon"><Navigation size={29} /></span><i /><b /><span className="art-end"><MapPin size={22} /></span></div>
        <h1>{replanning ? 'Find a new route' : 'Where are you going?'}</h1>
        <p>{replanning ? 'Find a new way to ' + places.to + '.' : 'Plan your London journey and follow one step at a time.'}</p>
      </div>}

      {!selected && !options && <section className="card form-card" aria-label="Plan a journey">
        <form onSubmit={event => { event.preventDefault(); find(); }} aria-busy={Boolean(busy)}>
          <div className="fields">
            {['from', 'to'].map(side => <div className="field" key={side}>
              <label htmlFor={side}>{fieldNames[side]}</label>
              <div className="input-wrap">
                {side === 'from' ? <LocateFixed size={20} aria-hidden="true" /> : <MapPin size={20} aria-hidden="true" />}
                <input id={side} value={places[side]} onChange={event => change(side, event.target.value)}
                  placeholder={side === 'from' ? (replanning ? 'Enter a nearby station or stop' : 'e.g. Waterloo Station') : 'e.g. Camden Town'}
                  disabled={Boolean(busy)} readOnly={replanning && side === 'to'} maxLength={300} required />
              </div>
            </div>)}
            {!replanning && <button type="button" className="swap" aria-label="Swap starting point and destination"
              onClick={swap} disabled={Boolean(busy)}><ArrowDownUp size={20} aria-hidden="true" /></button>}
          </div>
          <button className="primary" disabled={Boolean(busy)}><span>{busy || 'Find journeys'}</span>
            <ArrowRight size={22} aria-hidden="true" /></button>
        </form>
        {!replanning && <div className="example"><span>Station, stop, address or postcode</span><button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => change('to', 'Camden Town Underground Station')}>Try Camden Town</button></div>}
      </section>}

      {error && <div className="message" role="alert">{error}</div>}
      {busy && <p className="sr-only" role="status">{busy}</p>}

      {!selected && options && <section className="card results">
        <h2 tabIndex={-1} ref={focus}>Choose the right place</h2>
        <form onSubmit={event => {
          event.preventDefault();
          const origin = picks.from || values.from || places.from;
          const destination = picks.to || values.to || places.to;
          setPlaces(old => ({
            from: options.from.find(item => item.value === picks.from)?.label || old.from,
            to: options.to.find(item => item.value === picks.to)?.label || old.to,
          }));
          setValues({ from: origin, to: destination });
          find(origin, destination);
        }}>
          {['from', 'to'].filter(side => options[side].length).map(side => <div className="field choice" key={side}>
            <label htmlFor={'choice-' + side}>{fieldNames[side]}</label>
            <select required id={'choice-' + side} value={picks[side]} disabled={Boolean(busy)}
              onChange={event => setPicks(old => ({ ...old, [side]: event.target.value }))}>
              <option value="">Select a place</option>
              {options[side].map((option, i) => <option key={i} value={option.value}>{option.label}</option>)}
            </select>
          </div>)}
          <button className="primary" disabled={Boolean(busy)}>Find journeys <ArrowRight size={22} aria-hidden="true" /></button>
          <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => setOptions(null)}>Edit places</button>
        </form>
      </section>}

      {!selected && journeys && <section className="results">
        <h2 tabIndex={-1} ref={focus}>{journeys.length ? 'Choose your journey' : 'No journeys found'}</h2>
        {!journeys.length && <p>Try a nearby station, a full address or a postcode.</p>}
        {notices.map((notice, i) => <p key={i}>{notice}</p>)}
        <div className="route-list">{(otherRoutes ? journeys : journeys.slice(0, 1)).map((journey, i) => {
          const changes = Math.max(0, journey.legs.filter(leg => leg.line || leg.mode && leg.mode !== 'walking').length - 1);
          return <button className="route-option card" key={i} disabled={Boolean(busy)}
            onClick={() => { setPreview(journey); setError(''); }} aria-expanded={preview === journey}>
            <span className="route-content">
              {i === 0 && <span className="suggested">Suggested journey</span>}
              <strong>{Number.isFinite(journey.duration) ? 'About ' + journey.duration + ' min' : 'Travel time unavailable'}</strong>
              <span>{[planTime(journey.start), planTime(journey.end)].filter(Boolean).join(' – ') || 'Times unavailable'} · Estimated · {changes ? changes + (changes === 1 ? ' change' : ' changes') : 'No changes'}</span>
              <span className="route-modes">{journey.legs.map((leg, l) => <span key={l}>
                <Vehicle mode={leg.mode} size={17} /> {leg.name || modes[leg.mode] || leg.mode || 'Mode unavailable'}{Number.isFinite(leg.duration) && ` · ${leg.duration} min`}
              </span>)}</span>
            </span><ChevronRight aria-hidden="true" />
          </button>;
        })}</div>
        {journeys.length > 1 && <button className="text-button" onClick={() => setOtherRoutes(!otherRoutes)} aria-expanded={otherRoutes}>{otherRoutes ? 'Hide other routes' : 'See other routes'}</button>}
        {preview && <div className="card route-preview">
          <h3 ref={previewTitle} tabIndex={-1}>Journey preview</h3>
          <RouteDiagram journey={preview} />
          <button className="primary" disabled={Boolean(busy)} onClick={() => { setSelected(preview); setIndex(0); setError(''); setNearby(false); }}>
            Start journey <ArrowRight size={22} aria-hidden="true" />
          </button>
        </div>}
      </section>}

      {selected && <section className="guide">
        <button className="text-button" onClick={() => { setSelected(null); setError(''); setReading(false); }} disabled={Boolean(busy)}>
          <ArrowLeft size={19} aria-hidden="true" /> Journey options</button>
        {step ? <div className="card step-card">
          <div className="step-meta">
            <span>Step {index + 1} of {steps.length}</span>
            <span className="mode-name">
              {tubeColours[step.leg.line] && <i aria-hidden="true" style={{ background: tubeColours[step.leg.line] }} />}
              {step.leg.mode === 'tube' && step.leg.name ? step.leg.name + ' line' : modes[step.leg.mode] || step.leg.mode || 'Journey step'}
            </span>
          </div>
          <progress value={index + 1} max={steps.length} aria-label="Journey progress" />
          <div className="step-icon"><Vehicle mode={step.leg.mode} size={40} /></div>
          <h1 ref={focus} tabIndex={-1}>{step.title}</h1>
          {step.detail && <p className="step-detail">{step.detail}</p>}
          {step.kind === 'board' && <p className="estimate">{planTime(step.leg.departure)
            ? 'TfL journey estimate: ' + planTime(step.leg.departure) : 'Estimated departure unavailable'}</p>}
          {speechSupported && <button className="secondary read" onClick={read}>
            <Volume2 size={21} aria-hidden="true" /> {reading ? 'Stop reading' : 'Read this step aloud'}
          </button>}
          <LiveDetails key={index} step={step} />
          <details className="route-details"><summary>See my route</summary><RouteDiagram journey={selected} /></details>
          <button className="primary" onClick={() => advance(index + 1)} disabled={Boolean(busy)}>
            {step.kind === 'board' ? 'I’m on board' : step.kind === 'exit' ? 'I’m off' : 'I’ve done this'}
            <Check size={22} aria-hidden="true" /></button>
          {index > 0 && <button className="text-button back-step" disabled={Boolean(busy)} onClick={() => advance(index - 1)}>
            <ArrowLeft size={19} aria-hidden="true" /> Previous step</button>}
        </div> : <div className="card step-card">
          <div className="step-icon"><Check size={40} aria-hidden="true" /></div>
          <h1 ref={focus} tabIndex={-1}>Journey complete</h1>
          <p className="step-detail">You’ve confirmed all your journey steps.</p>
          <button className="primary" onClick={reset}>Plan another journey <ArrowRight size={22} aria-hidden="true" /></button>
        </div>}
        {step && <div className="help">
          <button className="secondary" onClick={missedStop} disabled={Boolean(busy)}>
            <CircleHelp size={22} aria-hidden="true" /> {busy || 'I missed my stop'}</button>
          <p>Use your location once to find a new route.</p>
          {nearby && <form className="nearby" onSubmit={event => {
            event.preventDefault();
            const stop = new FormData(event.currentTarget).get('nearby').trim();
            if (!stop) return;
            setPlaces(old => ({ ...old, from: stop }));
            setValues(old => ({ ...old, from: stop }));
            find(stop, values.to || places.to);
          }}>
            <label htmlFor="nearby">What stop or station are you near?</label>
            <input ref={nearbyInput} id="nearby" name="nearby" placeholder="Enter a nearby stop" required maxLength={300} disabled={Boolean(busy)} />
            <button className="primary" disabled={Boolean(busy)}>Find a new route <ArrowRight size={22} aria-hidden="true" /></button>
            <details><summary>I’m not sure</summary><p>I missed my stop. Can you help me get to {places.to}?</p></details>
          </form>}
        </div>}
      </section>}
      <footer>Journey information from <a href="https://tfl.gov.uk/">Transport for London</a></footer>
    </main>
  </>;
}

