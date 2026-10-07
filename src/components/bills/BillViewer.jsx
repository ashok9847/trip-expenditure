import Modal from '../ui/Modal.jsx';
import { DownloadIcon } from '../ui/Icons.jsx';
import { useReceiptUrl } from '../../hooks/useReceiptUrl.js';
import { slugify } from '../../utils/download.js';

/**
 * Full-size view of a bill. Pass either a stored `receiptId` or a ready `url` + `type`
 * (for a freshly picked file that hasn't been saved yet).
 */
export default function BillViewer({ receiptId, url: directUrl, type: directType, title = 'Bill', onClose }) {
  const stored = useReceiptUrl(directUrl ? null : receiptId);
  const url = directUrl ?? stored.url;
  const type = directType ?? stored.type;
  const isPdf = type === 'application/pdf';
  const filename = `${slugify(title)}-bill.${isPdf ? 'pdf' : 'jpg'}`;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        url && (
          <div className="grid grid-cols-2 gap-2">
            <a className="btn-secondary" href={url} target="_blank" rel="noopener noreferrer">
              Open full size
            </a>
            <a className="btn-primary" href={url} download={filename}>
              <DownloadIcon /> Download
            </a>
          </div>
        )
      }
    >
      {stored.status === 'loading' && !directUrl && <p className="py-10 text-center text-zinc-500">Loading bill…</p>}
      {stored.status === 'missing' && !directUrl && (
        <p className="py-10 text-center text-zinc-500">
          This bill couldn’t be found on this device. It may have been cleared with the browser’s site data.
        </p>
      )}
      {url &&
        (isPdf ? (
          <p className="py-6 text-center text-zinc-600 dark:text-zinc-300">
            PDF bill attached. Use “Open full size” to view it.
          </p>
        ) : (
          <img src={url} alt={`Bill for ${title}`} className="mx-auto max-h-[65dvh] w-auto rounded-xl object-contain" />
        ))}
    </Modal>
  );
}
