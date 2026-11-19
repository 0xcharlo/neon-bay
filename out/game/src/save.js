// Neon Bay — saving to localStorage so cash and story progress survive
// a closed tab. Nothing here touches the network.

const KEY = 'neonbay.v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Math.max(0, data.cash | 0),
      missionIndex: Math.max(0, Math.min(3, data.missionIndex | 0)),
      earned: Math.max(0, data.earned | 0),
      bestWanted: Math.max(0, Math.min(5, data.bestWanted | 0)),
      gigsDone: Math.max(0, data.gigsDone | 0),
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      earned: state.earned,
      bestWanted: state.bestWanted,
      gigsDone: state.gigsDone,
    }));
  } catch {
    // A browser that refuses storage still plays fine.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
