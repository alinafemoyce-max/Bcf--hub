/**
 * True when built as a claude.ai Artifact preview (`npm run build:preview`). That host runs pages in a
 * locked-down frame with no service worker, file downloads, share sheet or printing, so those
 * features are hidden rather than shown as buttons that do nothing.
 */
export const IS_PREVIEW = import.meta.env.VITE_TARGET === 'artifact';
