import { useEffect, useRef, RefObject } from 'react';

/**
 * Synchronizes a native `<dialog>` element with React `isOpen` state,
 * resets `returnValue` on close, and adds a feature-detected
 * pointer light-dismiss fallback when `closedby` is unsupported.
 */
export function useNativeDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [dialogRef, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    let pointerStartedOutside = false;

    const isOutsideDialog = (clientX: number, clientY: number): boolean => {
      const rect = dialog.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      return (
        clientY < rect.top ||
        clientY > rect.top + rect.height ||
        clientX < rect.left ||
        clientX > rect.left + rect.width
      );
    };

    const handleNativeClose = () => {
      dialog.returnValue = '';
      onCloseRef.current();
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerStartedOutside = isOutsideDialog(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pointerStartedOutside && isOutsideDialog(event.clientX, event.clientY)) {
        dialog.close();
      }
      pointerStartedOutside = false;
    };

    dialog.addEventListener('close', handleNativeClose);
    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    if (!supportsClosedBy) {
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      if (!supportsClosedBy) {
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerup', handlePointerUp);
      }
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [dialogRef, isOpen]);
}
