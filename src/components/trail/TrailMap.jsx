// "Trip Journey": the trip as a flat travel-poster road map. A small car
// drives the road stop to stop; tapping a stop opens a card with every share.
import '@fontsource-variable/space-grotesk';
import './trail.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { useStickers } from '../../hooks/useStickers.js';
import { buildJourney } from '../../utils/journey.js';
import { formatMoney } from '../../utils/money.js';
import { computeShares } from '../../utils/splits.js';
import { totalExpenditure } from '../../utils/balances.js';
import { layoutTrail } from '../../utils/trailLayout.js';
import { REDUCED_TIMING, TIMING, buildSchedule, legAt, lengthAt, reachedAt } from '../../utils/trailTimeline.js';
import { downloadFile, slugify } from '../../utils/download.js';
import MapScene, { Mover } from './MapScene.jsx';
import { trailPalette } from './palette.js';
import Avatar from '../ui/Avatar.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { PauseIcon, PlayIcon, RouteIcon, ShareIcon, XIcon } from '../ui/Icons.jsx';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

const pct = (v, of) => `${(v / of) * 100}%`;

export default function TrailMap({ trip, isDark, onAdd }) {
  if (trip.expenses.length === 0) {
    return (
      <EmptyState
        icon={RouteIcon}
        title="No stops yet"
        action={
          onAdd && (
            <button type="button" className="btn-primary" onClick={onAdd}>
              Add expense
            </button>
          )
        }
      >
        Add an expense to start the trail.
      </EmptyState>
    );
  }
  return <Trail trip={trip} isDark={isDark} />;
}

function Trail({ trip, isDark }) {
  const { currency } = useAppState();
  const toast = useToast();
  const money = useCallback((v) => formatMoney(v, currency), [currency]);
  const pal = trailPalette(isDark);
  const reduced = useReducedMotion();
  const byId = useMemo(() => new Map(trip.participants.map((p) => [p.id, p])), [trip.participants]);
  const nameOf = useCallback((id) => byId.get(id)?.name ?? 'someone', [byId]);

  const { stops } = useMemo(() => buildJourney(trip), [trip]);
  const total = useMemo(() => totalExpenditure(trip.expenses), [trip.expenses]);
  const stickers = useStickers(stops.map((s) => s.description));
  const view = useMemo(() => stops.map((s) => ({ sticker: stickers.get(s.description) })), [stops, stickers]);

  const layout = useMemo(
    () =>
      layoutTrail(
        stops.map((s) => ({ id: s.id, amount: s.amount, day: s.day, newDay: s.newDay, title: '', caption: '', debtCount: 0, owesLabel: '' })),
        { seed: trip.id },
      ),
    [stops, trip.id],
  );
  const schedule = useMemo(() => buildSchedule(stops.length, reduced ? REDUCED_TIMING : TIMING), [stops.length, reduced]);

  // ---- UI state ---------------------------------------------------------
  const [openId, setOpenId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reached, setReached] = useState(stops.length);
  const [landed, setLanded] = useState(null);
  // true while 0 <= t < total after playback/scrubbing started (Playing / Paused)
  const [active, setActive] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Whose avatar is travelling: the payer of the stop the traveller is heading to (or parked at).
  const [moverId, setMoverId] = useState(stops[0]?.payerId ?? null);
  const moverRef = useRef(moverId);

  // ---- playback refs (per-frame work bypasses React) --------------------
  const tRef = useRef(schedule.total);
  const reachedRef = useRef(stops.length);
  const activeRef = useRef(false);
  const lengthsRef = useRef(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const svgRef = useRef(null);
  const maskRef = useRef(null);
  const trailRef = useRef(null);
  const measureRef = useRef(null);
  const carRef = useRef(null);
  const scrubRef = useRef(null);
  const followRef = useRef(false);
  const lastFlip = useRef(1);
  const refs = useMemo(() => ({ mask: maskRef, trail: trailRef, measure: measureRef }), []);

  // Detail card refs
  const stopRefs = useRef(new Map());
  const cardRef = useRef(null);
  const closeRef = useRef(null);

  // Rest state (full road) whenever the data changes.
  useEffect(() => {
    setPlaying(false);
    followRef.current = false;
    tRef.current = schedule.total;
    reachedRef.current = stops.length;
    activeRef.current = false;
    setActive(false);
    setReached(stops.length);
    setLanded(null);
  }, [layout, schedule, stops.length]);

  const apply = (t, events) => {
    const lens = lengthsRef.current;
    const path = trailRef.current;
    if (!lens || !path) return;
    const pathLen = lens[lens.length - 1];
    const isActive = t < schedule.total;
    if (isActive !== activeRef.current) {
      activeRef.current = isActive;
      setActive(isActive);
    }
    // Rest/Finished and reduced motion: whole road at 100%.
    const L = isActive && !reduced ? lengthAt(t, schedule, lens) : pathLen;
    if (maskRef.current) maskRef.current.style.strokeDashoffset = String(pathLen - L);

    const car = carRef.current;
    if (car) {
      const showCar = isActive && !reduced;
      car.style.display = showCar ? '' : 'none';
      if (showCar) {
        // The avatar stays upright; it just rides the road.
        const p = path.getPointAtLength(L);
        car.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        // Leg k heads to stop k. While parked at stop k-1 (dwell), legAt already reports leg k
        // with frac 0, so keep showing stop k-1's payer until the traveller actually leaves.
        const { leg, frac } = legAt(t, schedule);
        const idx = frac <= 0 && leg > 0 ? leg - 1 : leg;
        const payer = stops[Math.min(idx, stops.length - 1)]?.payerId ?? null;
        if (payer !== moverRef.current) {
          moverRef.current = payer;
          setMoverId(payer);
        }
      }
    }
    if (scrubRef.current) scrubRef.current.value = String(Math.round((t / schedule.total) * 1000));

    const r = reachedAt(t, schedule);
    if (r !== reachedRef.current) {
      const prev = reachedRef.current;
      reachedRef.current = r;
      setReached(r);
      if (events && r === prev + 1) setLanded({ i: r - 1, key: performance.now() });
    }
    if (events && followRef.current && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const k = rect.width / layout.width;
      const y = reduced ? layout.stops[Math.max(0, r - 1)]?.cy ?? 0 : path.getPointAtLength(L).y;
      window.scrollTo(0, rect.top + window.scrollY + y * k - window.innerHeight * 0.45);
    }
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // Measure cumulative road length at every stop.
  useLayoutEffect(() => {
    const m = measureRef.current;
    if (!m || typeof m.getTotalLength !== 'function') return;
    const lens = [0];
    for (let k = 1; k <= layout.segments.length; k++) {
      m.setAttribute('d', `${layout.trailStart} ${layout.segments.slice(0, k).join(' ')}`);
      lens.push(m.getTotalLength());
    }
    lengthsRef.current = lens;
    const pathLen = lens[lens.length - 1];
    if (maskRef.current) maskRef.current.style.strokeDasharray = `${pathLen} ${pathLen}`;
    applyRef.current(tRef.current, false);
  }, [layout, pal.dark]);

  // Animation loop.
  useEffect(() => {
    if (!playing) return;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last) * speedRef.current;
      last = now;
      const t = Math.min(schedule.total, tRef.current + dt);
      tRef.current = t;
      applyRef.current(t, true);
      if (t >= schedule.total) {
        // Finished: just stop.
        followRef.current = false;
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, schedule]);

  const pause = () => {
    setPlaying(false);
    followRef.current = false;
  };

  const play = () => {
    if (playing) return pause();
    setOpenId(null);
    if (tRef.current >= schedule.total) {
      tRef.current = 0;
      reachedRef.current = 0;
      setReached(0);
      setLanded(null);
      applyRef.current(0, false);
    }
    followRef.current = true;
    setPlaying(true);
  };

  const scrub = (e) => {
    pause();
    const t = (Number(e.target.value) / 1000) * schedule.total;
    tRef.current = t;
    applyRef.current(t, false);
  };

  // ---- detail card ------------------------------------------------------
  const openIdRef = useRef(openId);
  openIdRef.current = openId;
  const closeCard = useCallback(() => {
    const id = openIdRef.current;
    setOpenId(null);
    if (id) stopRefs.current.get(id)?.focus();
  }, []);

  const toggleStop = (id) => {
    if (openId === id) return closeCard();
    pause();
    setOpenId(id);
  };

  useEffect(() => {
    if (!openId) return;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCard();
      }
    };
    const onDown = (e) => {
      if (cardRef.current?.contains(e.target)) return;
      if (stopRefs.current.get(openId)?.contains(e.target)) return;
      closeCard();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [openId, closeCard]);

  // ---- share ------------------------------------------------------------
  const shareStory = async () => {
    setSharing(true);
    try {
      const { renderStory } = await import('./story.jsx');
      const blob = await renderStory({ layout, trip, stops, view, pal, money, nameOf, total });
      const name = `${slugify(trip.name)}-story.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: trip.name });
      } else {
        downloadFile(name, blob, 'image/png');
        toast('Story saved.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Couldn’t share the story. Please try again.', 'error');
    } finally {
      setSharing(false);
    }
  };

  const open = openId && layout.stops.find((l) => l.id === openId);
  const openStop = open && stops[open.index];
  const openExpense = openStop && trip.expenses.find((e) => e.id === openStop.id);
  const titleId = `trail-card-title-${trip.id}`;
  // Keep the card inside the map: stops in the lower part open upwards.
  const cardAbove = open && open.cy > layout.height * 0.6;

  return (
    <div className="trail card overflow-hidden rounded-2xl">
      {/* Control bar (topmost element) */}
      <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button type="button" onClick={play} className="btn-primary h-11 shrink-0" aria-pressed={playing}>
          {playing ? <PauseIcon /> : <PlayIcon />}
          {playing ? 'Pause' : 'Play trip'}
        </button>
        <input
          ref={scrubRef}
          type="range"
          min="0"
          max="1000"
          defaultValue="1000"
          onChange={scrub}
          className="trail-scrub min-w-0 flex-1"
          aria-label="Trip position"
        />
        <button
          type="button"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          className="btn-secondary font-grot h-11 w-14 shrink-0 px-0"
          aria-label={`Speed ${speed}x, tap to change`}
        >
          {speed}x
        </button>
      </div>

      {/* The map */}
      <div className="relative" style={{ background: pal.paper }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block h-auto w-full select-none"
          role="img"
          aria-label={`Trail map of ${trip.name}: ${stops.length} expenses from start to finish.`}
        >
          <MapScene
            layout={layout}
            trip={trip}
            stops={stops}
            view={view}
            pal={pal}
            reached={reached}
            landed={landed}
            idp="tm"
            live
            refs={refs}
            money={money}
            nameOf={nameOf}
            reduced={reduced}
            showBase={!reduced && active}
          >
            <g ref={carRef} style={{ display: 'none' }} aria-hidden="true">
              <Mover trip={trip} person={byId.get(moverId) ?? { id: moverId, name: nameOf(moverId) }} pal={pal} idp="tm" />
            </g>
          </MapScene>
        </svg>

        {/* Tap targets over each stop's marker and labels */}
        {layout.stops.map((L) => {
          const s = stops[L.index];
          const x0 = Math.min(L.x - L.size / 2, L.side > 0 ? 24 : L.textX);
          const x1 = Math.max(L.x + L.size / 2, L.side > 0 ? L.textX : L.textX + L.textW);
          const y0 = L.cy - L.hh + 4;
          const y1 = L.cy + L.hh;
          return (
            <button
              key={L.id}
              ref={(el) => {
                if (el) stopRefs.current.set(L.id, el);
                else stopRefs.current.delete(L.id);
              }}
              type="button"
              className="absolute rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ left: pct(x0, layout.width), width: pct(x1 - x0, layout.width), top: pct(y0, layout.height), height: pct(y1 - y0, layout.height), outlineColor: pal.text }}
              aria-expanded={openId === L.id}
              aria-label={`${money(s.amount)} paid by ${nameOf(s.payerId)} for ${s.description}. Show shares.`}
              onClick={() => toggleStop(L.id)}
            />
          );
        })}

        {/* Detail card */}
        {open && openStop && (
          <div
            ref={cardRef}
            role="dialog"
            aria-labelledby={titleId}
            className="absolute left-[5%] z-10 w-[90%] rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            style={cardAbove ? { bottom: pct(layout.height - (open.cy - open.hh + 4), layout.height) } : { top: pct(open.cy + open.hh - 6, layout.height) }}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id={titleId} className="pt-2 text-base font-semibold tracking-tight">
                {openStop.description}
              </h3>
              <button ref={closeRef} type="button" onClick={closeCard} className="icon-btn -mt-1 -mr-1 size-11" aria-label="Close">
                <XIcon />
              </button>
            </div>
            <p className="font-grot text-2xl font-bold">{money(openStop.amount)}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Avatar trip={trip} id={openStop.payerId} name={nameOf(openStop.payerId)} size="xs" />
              Paid by {nameOf(openStop.payerId)}
            </p>
            <ul className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              {openExpense &&
                Object.entries(computeShares(openExpense)).map(([id, share]) => (
                  <li key={id} className="flex items-center gap-2">
                    <Avatar trip={trip} id={id} name={nameOf(id)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{nameOf(id)}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {id === openStop.payerId ? 'own share' : `owes ${nameOf(openStop.payerId)}`}
                      </span>
                    </span>
                    <span className="font-grot text-right text-sm font-semibold tabular-nums">{money(share)}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <p className="font-grot text-sm font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
          {stops.length} {stops.length === 1 ? 'stop' : 'stops'} · {money(total)}
        </p>
        <button type="button" onClick={shareStory} disabled={sharing} className="btn-secondary">
          <ShareIcon />
          {sharing ? 'Making story…' : 'Share as story'}
        </button>
      </div>
    </div>
  );
}
