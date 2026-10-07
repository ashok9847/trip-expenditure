import { useId, useRef, useState } from 'react';

export function validateTrip({ name, startDate, endDate }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Give your trip a name, e.g. "Goa 2026".';
  else if (name.trim().length > 50) errors.name = 'Keep the name under 50 characters.';
  if (startDate && endDate && endDate < startDate) errors.endDate = 'End date can’t be before the start date.';
  return errors;
}

/** Trip name + optional date range. Used for create and edit. */
export default function TripForm({ initial, onSubmit, submitLabel = 'Create trip', formId, hideSubmit = false, autoFocus = true }) {
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
  });
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);
  const ids = { name: useId(), start: useId(), end: useId() };

  const set = (key) => (e) => {
    const next = { ...values, [key]: e.target.value };
    setValues(next);
    if (Object.keys(errors).length) setErrors(validateTrip(next));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validateTrip(values);
    setErrors(errs);
    if (errs.name) nameRef.current?.focus();
    if (Object.keys(errs).length === 0) onSubmit({ ...values, name: values.name.trim() });
  };

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor={ids.name} className="label">
          Trip name
        </label>
        <input
          id={ids.name}
          ref={nameRef}
          className="input"
          value={values.name}
          onChange={set('name')}
          placeholder="e.g. Goa with college gang"
          maxLength={60}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${ids.name}-err` : undefined}
        />
        {errors.name && (
          <p id={`${ids.name}-err`} className="field-error">
            {errors.name}
          </p>
        )}
      </div>
      <fieldset>
        <legend className="label">
          Dates <span className="font-normal text-zinc-500">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={ids.start} className="sr-only">
              Start date
            </label>
            <input id={ids.start} type="date" className="input" value={values.startDate} onChange={set('startDate')} />
          </div>
          <div>
            <label htmlFor={ids.end} className="sr-only">
              End date
            </label>
            <input
              id={ids.end}
              type="date"
              className="input"
              value={values.endDate}
              min={values.startDate || undefined}
              onChange={set('endDate')}
              aria-invalid={!!errors.endDate}
              aria-describedby={errors.endDate ? `${ids.end}-err` : undefined}
            />
          </div>
        </div>
        {errors.endDate && (
          <p id={`${ids.end}-err`} className="field-error">
            {errors.endDate}
          </p>
        )}
      </fieldset>
      {!hideSubmit && (
        <button type="submit" className="btn-primary w-full">
          {submitLabel}
        </button>
      )}
    </form>
  );
}
