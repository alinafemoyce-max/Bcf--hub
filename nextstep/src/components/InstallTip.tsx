import { useState } from 'react';
import { Icon } from './Icon';

const KEY = 'nextstep:install-tip-dismissed';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => isIOS() || /Android|Mobile/i.test(navigator.userAgent);
/** True when NextStep is already running from the Home Screen. */
export const isInstalled = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

function dismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Encourages phone users to add NextStep to their Home Screen, which keeps their progress safe. */
export function InstallTip({ compact }: { compact?: boolean }) {
  const [hidden, setHidden] = useState(() => isInstalled() || !isMobile() || dismissed());
  if (hidden) return null;
  const ios = isIOS();
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* storage blocked: just hide for now */
    }
    setHidden(true);
  };
  return (
    <aside className="install-tip" aria-label="Keep your progress">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="install-icon" aria-hidden="true">
          <Icon name="plus" size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 650 }}>Add NextStep to your Home Screen to keep your progress</p>
          {!compact && (
            <p className="small muted" style={{ marginTop: 4 }}>
              {ios ? (
                <>
                  In Safari, tap <strong>Share</strong> <Icon name="share" size={15} className="inline-icon" /> then <strong>Add to Home Screen</strong>. Then always open NextStep from the icon.
                </>
              ) : (
                <>
                  Open your browser menu and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>. Then always open NextStep from the icon.
                </>
              )}
            </p>
          )}
          <p className="small muted" style={{ marginTop: 4 }}>
            {compact
              ? 'Safari can clear progress on websites you haven’t opened for a while. The Home Screen app keeps it safe.'
              : 'Do this before you start: anything you do in the browser won’t move across to the Home Screen app.'}
          </p>
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }} onClick={close}>
        Got it
      </button>
    </aside>
  );
}
