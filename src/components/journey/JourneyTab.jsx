import { useState } from 'react';
import EmptyState from '../ui/EmptyState.jsx';
import { RouteIcon } from '../ui/Icons.jsx';
import TrailMap from '../trail/TrailMap.jsx';
import MoneyMap from './MoneyMap.jsx';

/** Visual views of the trip: the paper trail map (default) and the money map. */
export default function JourneyTab({ trip, isDark, onGoToPeople, onAdd }) {
  const [view, setView] = useState('journey');

  if (trip.participants.length === 0 || trip.expenses.length === 0) {
    const noPeople = trip.participants.length === 0;
    return (
      <EmptyState
        icon={RouteIcon}
        title={noPeople ? 'No travellers yet' : 'No stops yet'}
        action={
          <button type="button" className="btn-primary" onClick={noPeople ? onGoToPeople : onAdd}>
            {noPeople ? 'Add people' : 'Add the first expense'}
          </button>
        }
      >
        {noPeople
          ? 'Add the people on this trip, then log expenses to draw the route.'
          : 'Add an expense to start the trail.'}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Trip view" className="segmented">
        {[
          ['journey', 'Timeline'],
          ['map', 'Money map'],
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'journey' ? (
        <TrailMap trip={trip} isDark={isDark} onAdd={onAdd} />
      ) : (
        <MoneyMap trip={trip} isDark={isDark} />
      )}
    </div>
  );
}
