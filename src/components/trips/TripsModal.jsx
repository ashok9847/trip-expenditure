import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import TripForm from './TripForm.jsx';
import { CheckIcon, PencilIcon, PlusIcon } from '../ui/Icons.jsx';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { formatDateRange } from '../../utils/dates.js';
import { formatMoney } from '../../utils/money.js';
import { totalExpenditure } from '../../utils/balances.js';
import { deleteReceipts } from '../../storage/receipts.js';
import { makeDemoTrip } from '../../utils/demoTrip.js';
import { useCloud } from '../../cloud/CloudProvider.jsx';
import MembersField from '../cloud/MembersField.jsx';

/**
 * Switch between trips, create a new one, or edit/delete an existing one.
 * `initialMode` lets callers open straight into "new" or "edit".
 */
export default function TripsModal({ onClose, initialMode = 'list' }) {
  const { state, dispatch, activeTrip, currency } = useAppState();
  const toast = useToast();
  const { user } = useCloud();
  const [mode, setMode] = useState(initialMode); // 'list' | 'new' | { edit: tripId }
  const [confirmDelete, setConfirmDelete] = useState(null);

  const editing = typeof mode === 'object' ? state.trips.find((t) => t.id === mode.edit) : null;
  // A trip someone else owns: "delete" means leaving it.
  const isShared = (t) => !!t?.cloud && !!user && t.cloud.ownerUid !== user.uid;

  if (mode === 'new') {
    return (
      <Modal
        title="New trip"
        onClose={onClose}
        footer={
          <button type="submit" form="new-trip-form" className="btn-primary w-full">
            Create trip
          </button>
        }
      >
        <TripForm
          formId="new-trip-form"
          hideSubmit
          onSubmit={(v) => {
            dispatch({ type: 'ADD_TRIP', ...v });
            toast(`Trip “${v.name}” created`);
            onClose();
          }}
        />
      </Modal>
    );
  }

  if (editing) {
    return (
      <>
        <Modal
          title="Edit trip"
          onClose={onClose}
          footer={
            <div className="flex gap-2">
              <button type="button" className="btn-ghost text-red-600 dark:text-red-400" onClick={() => setConfirmDelete(editing)}>
                {isShared(editing) ? 'Leave trip' : 'Delete trip'}
              </button>
              <button type="submit" form="edit-trip-form" className="btn-primary flex-1">
                Save
              </button>
            </div>
          }
        >
          <TripForm
            formId="edit-trip-form"
            hideSubmit
            initial={editing}
            onSubmit={(v) => {
              dispatch({ type: 'UPDATE_TRIP', id: editing.id, ...v });
              toast('Trip updated');
              onClose();
            }}
          />
          <div className="mt-5">
            <MembersField trip={editing} />
          </div>
        </Modal>
        {confirmDelete && (
          <ConfirmDialog
            title={isShared(confirmDelete) ? 'Leave this trip?' : 'Delete this trip?'}
            message={
              isShared(confirmDelete)
                ? `You’ll lose access to “${confirmDelete.name}”. The owner and other members keep it.`
                : confirmDelete.cloud
                  ? `“${confirmDelete.name}” and its ${confirmDelete.expenses.length} expense(s) will be permanently deleted for everyone it’s shared with.`
                  : `“${confirmDelete.name}” and its ${confirmDelete.expenses.length} expense(s) will be permanently removed from this device.`
            }
            confirmLabel={isShared(confirmDelete) ? 'Leave trip' : 'Delete trip'}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => {
              dispatch({ type: 'DELETE_TRIP', id: confirmDelete.id });
              deleteReceipts(confirmDelete.expenses.map((e) => e.receiptId).filter(Boolean)).catch(() => {});
              toast('Trip deleted');
              onClose();
            }}
          />
        )}
      </>
    );
  }

  return (
    <Modal
      title="Your trips"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              dispatch({ type: 'IMPORT_TRIP', trip: makeDemoTrip() });
              toast('Demo trip loaded: 6 friends in Goa');
              onClose();
            }}
          >
            Load demo trip
          </button>
          <button type="button" className="btn-primary" onClick={() => setMode('new')}>
            <PlusIcon /> New trip
          </button>
        </div>
      }
    >
      <ul className="-mx-2 space-y-1">
        {state.trips.map((t) => {
          const active = t.id === activeTrip?.id;
          const range = formatDateRange(t.startDate, t.endDate);
          return (
            <li key={t.id} className="flex items-center gap-1">
              <button
                type="button"
                className={`flex min-h-14 flex-1 items-center gap-3 rounded-xl px-3 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  active ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                }`}
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  dispatch({ type: 'SET_ACTIVE_TRIP', id: t.id });
                  onClose();
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {[range, `${t.participants.length} people`, formatMoney(totalExpenditure(t.expenses), currency)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {active && <CheckIcon className="size-5 text-zinc-900" />}
              </button>
              <button type="button" className="icon-btn" aria-label={`Edit ${t.name}`} onClick={() => setMode({ edit: t.id })}>
                <PencilIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
