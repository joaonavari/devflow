import { useRef } from 'react';

// Disabled buttons are visual feedback; this also covers Enter and two submits
// before React has rendered the pending state, including async validation.
export function useSubmitOnce<T>(submit: (input: T) => Promise<unknown>) {
  const pending = useRef(false);
  return async (input: T) => {
    if (pending.current) return;
    pending.current = true;
    try {
      await submit(input);
    } finally {
      pending.current = false;
    }
  };
}
