import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, tone = 'danger' }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{message}</p>
    </Modal>
  );
}
