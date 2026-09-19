import type { MouseEvent } from 'react';

export function isDialogBackdropClick(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const bounds = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  );
}

const openers = new WeakMap<HTMLDialogElement, Element | null>();

export function captureDialogOpener(dialog: HTMLDialogElement | null) {
  if (!dialog) return null;
  if (!dialog.open) openers.set(dialog, document.activeElement);
  return openers.get(dialog) ?? null;
}

export function restoreDialogFocus(opener: Element | null, dialog: HTMLDialogElement | null) {
  requestAnimationFrame(() => {
    // StrictMode can rerun effects while the dialog is still open.
    if (dialog?.isConnected && dialog.open) return;
    const target =
      opener instanceof HTMLElement && opener.isConnected
        ? opener
        : document.querySelector<HTMLElement>('main h1, main');
    target?.focus({ preventScroll: true });
  });
}
