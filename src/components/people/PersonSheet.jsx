import { useId, useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Avatar from '../ui/Avatar.jsx';
import { CameraIcon, TrashIcon, UploadIcon } from '../ui/Icons.jsx';
import { photoToDataUrl, qrToDataUrl } from '../../utils/image.js';
import { isUpi } from '../../storage/storage.js';

/**
 * Edit one person: name, optional photo, optional UPI ID (used by the Pay
 * button on the settle-up card).
 */
export default function PersonSheet({ trip, person, validateName, onSave, onClose }) {
  const uid = useId();
  const [name, setName] = useState(person.name);
  const [photo, setPhoto] = useState(person.photo ?? null);
  const [upi, setUpi] = useState(person.upi ?? '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(person.qr ?? null);
  const [qrBusy, setQrBusy] = useState(false);
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const qrRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await photoToDataUrl(file));
      setErrors((x) => ({ ...x, photo: null }));
    } catch (err) {
      setErrors((x) => ({ ...x, photo: err.message }));
    } finally {
      setBusy(false);
    }
  };

  // Nothing is stored until Save, so Replace/Remove then closing keeps the stored QR.
  const pickQr = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setQrBusy(true);
    try {
      setQr(await qrToDataUrl(file));
      setErrors((x) => ({ ...x, qr: null }));
    } catch (err) {
      // Keep the previous QR; show the reason inline.
      setErrors((x) => ({ ...x, qr: err?.message || 'Couldn’t read that image. Try another one.' }));
    } finally {
      setQrBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const trimmedUpi = upi.trim();
    const next = {
      name: validateName(name, person.id),
      upi: trimmedUpi && !isUpi(trimmedUpi) ? 'That UPI ID isn’t valid. Use a format like name@bank.' : null,
      qr: null,
    };
    setErrors(next);
    if (next.name) return document.getElementById(`${uid}-name`)?.focus();
    if (next.upi) return document.getElementById(`${uid}-upi`)?.focus();
    // PeopleTab closes the sheet when the save succeeds.
    const ok = onSave({ name: name.trim(), photo, upi: trimmedUpi || null, qr });
    if (ok === false) setErrors((x) => ({ ...x, qr: 'Couldn’t save the image. Browser storage is full.' }));
  };

  return (
    <Modal
      title="Edit person"
      onClose={onClose}
      footer={
        <button type="submit" form={`${uid}-form`} className="btn-primary h-12 w-full" disabled={busy || qrBusy}>
          Save
        </button>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate className="space-y-5">
        <div className="flex flex-col items-center gap-3 pt-1">
          <Avatar trip={trip} id={person.id} name={name || person.name} size="xl" photo={photo} />
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} tabIndex={-1} aria-hidden="true" />
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={pick} tabIndex={-1} aria-hidden="true" data-testid="photo-upload" />
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-secondary h-10 px-3 text-sm" onClick={() => cameraRef.current?.click()} disabled={busy}>
              <CameraIcon className="size-4" /> Take photo
            </button>
            <button type="button" className="btn-secondary h-10 px-3 text-sm" onClick={() => uploadRef.current?.click()} disabled={busy}>
              <UploadIcon className="size-4" /> {photo ? 'Change' : 'Choose photo'}
            </button>
            {photo && (
              <button type="button" className="btn-ghost h-10 px-3 text-sm text-red-600 dark:text-red-400" onClick={() => setPhoto(null)}>
                <TrashIcon className="size-4" /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {busy ? 'Processing photo…' : 'Optional. Without a photo we show their initials.'}
          </p>
          {errors.photo && (
            <p className="field-error" role="alert">
              {errors.photo}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${uid}-name`} className="label">
            Name
          </label>
          <input
            id={`${uid}-name`}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoCapitalize="words"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${uid}-name-err` : undefined}
          />
          {errors.name && (
            <p id={`${uid}-name-err`} className="field-error">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${uid}-upi`} className="label">
            UPI ID <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id={`${uid}-upi`}
            className="input"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="name@okaxis"
            autoComplete="off"
            autoCapitalize="none"
            inputMode="email"
            aria-invalid={!!errors.upi}
            aria-describedby={`${uid}-upi-hint`}
          />
          <p id={`${uid}-upi-hint`} className={errors.upi ? 'field-error' : 'mt-1.5 text-xs text-zinc-500 dark:text-zinc-400'}>
            {errors.upi ?? 'Lets friends pay them straight from the settle-up card.'}
          </p>
        </div>

        <div role="group" aria-labelledby={`${uid}-qr-label`} aria-describedby={errors.qr ? `${uid}-qr-err` : `${uid}-qr-hint`}>
          <p id={`${uid}-qr-label`} className="label">
            Payment QR <span className="font-normal text-zinc-400">(optional)</span>
          </p>
          <input
            ref={qrRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickQr}
            tabIndex={-1}
            aria-hidden="true"
            data-testid="qr-upload"
          />
          {qr ? (
            <div className="flex items-center gap-3">
              <img
                src={qr}
                alt={`Payment QR for ${name.trim() || person.name}`}
                className="size-24 shrink-0 rounded-lg border border-zinc-200 bg-white object-contain dark:border-zinc-700"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary h-11 px-3 text-sm"
                  onClick={() => qrRef.current?.click()}
                  disabled={qrBusy}
                  aria-describedby={errors.qr ? `${uid}-qr-err` : undefined}
                >
                  <UploadIcon className="size-4" /> Replace
                </button>
                <button
                  type="button"
                  className="btn-ghost h-11 px-3 text-sm text-red-600 dark:text-red-400"
                  onClick={() => {
                    setQr(null);
                    setErrors((x) => ({ ...x, qr: null }));
                  }}
                  disabled={qrBusy}
                >
                  <TrashIcon className="size-4" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary h-11 px-3 text-sm"
              onClick={() => qrRef.current?.click()}
              disabled={qrBusy}
              aria-describedby={errors.qr ? `${uid}-qr-err` : `${uid}-qr-hint`}
            >
              <UploadIcon className="size-4" /> Upload QR
            </button>
          )}
          {errors.qr ? (
            <p id={`${uid}-qr-err`} className="field-error" role="alert">
              {errors.qr}
            </p>
          ) : (
            <p id={`${uid}-qr-hint`} className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              {qrBusy ? 'Processing image…' : 'A screenshot of their UPI or bank QR code. Friends can scan it to pay.'}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
