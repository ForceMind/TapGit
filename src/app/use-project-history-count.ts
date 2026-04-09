import { useEffect, useState } from 'react';
import { getBridge, unwrapResult } from '../services/bridge';

export function useProjectHistoryCount(
  projectPath?: string,
  isProtected?: boolean,
  refreshKey = ''
) {
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistoryCount() {
      if (!projectPath || !isProtected) {
        if (!cancelled) {
          setHistoryCount(null);
          setHistoryLoading(false);
        }
        return;
      }

      setHistoryLoading(true);
      try {
        const history = await unwrapResult(getBridge().listHistory(projectPath));
        if (!cancelled) {
          setHistoryCount(history.length);
        }
      } catch {
        if (!cancelled) {
          setHistoryCount(null);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistoryCount();

    return () => {
      cancelled = true;
    };
  }, [isProtected, projectPath, refreshKey]);

  return {
    historyCount,
    historyLoading
  };
}
