import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from '@shared/version';

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseName: string;
  publishedAt: string;
  releaseUrl: string;
}

interface UpdateStatus {
  status: 'idle' | 'checking' | 'downloading' | 'backing-up' | 'extracting' | 'installing' | 'restarting' | 'complete' | 'error' | 'rolling-back';
  message: string;
  progress: number;
  error?: string;
}

interface VersionCheckResult {
  updateAvailable: boolean;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseName: string | null;
  releaseUrl: string | null;
  checkForUpdates: () => Promise<void>;
  dismissUpdate: () => void;
  showUpdateNotification: boolean;
  startUpdate: () => Promise<void>;
  startRollback: () => Promise<void>;
  updateStatus: UpdateStatus;
  isUpdating: boolean;
}

const DISMISS_KEY = 'update-dismissed-date';
const LAST_CHECK_KEY = 'version-last-check';

function isDismissedToday(): boolean {
  const dismissedDate = localStorage.getItem(DISMISS_KEY);
  if (!dismissedDate) return false;
  const today = new Date().toDateString();
  return dismissedDate === today;
}

function shouldCheckNow(): boolean {
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  if (!lastCheck) return true;
  const lastCheckDate = new Date(lastCheck);
  const now = new Date();
  const today8am = new Date(now);
  today8am.setHours(8, 0, 0, 0);
  if (now >= today8am && lastCheckDate < today8am) {
    return true;
  }
  return false;
}

function getNextCheckTime(): Date {
  const now = new Date();
  const next8am = new Date(now);
  next8am.setHours(8, 0, 0, 0);
  if (now >= next8am) {
    next8am.setDate(next8am.getDate() + 1);
  }
  return next8am;
}

export function useVersionCheck(): VersionCheckResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [releaseName, setReleaseName] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    status: 'idle',
    message: 'No update in progress',
    progress: 0,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      console.log('Checking for updates via server...');
      const response = await fetch('/api/update/check', {
        method: 'GET',
        cache: 'no-cache',
      });

      if (!response.ok) {
        console.log('Update check failed:', response.status);
        return;
      }

      const data: UpdateInfo = await response.json();
      console.log(`Current version: ${APP_VERSION}, Latest version: ${data.latestVersion}`);

      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());

      setLatestVersion(data.latestVersion);
      setUpdateAvailable(data.updateAvailable);
      setReleaseNotes(data.releaseNotes);
      setReleaseName(data.releaseName);
      setReleaseUrl(data.releaseUrl);

      if (data.updateAvailable && !isDismissedToday()) {
        setShowNotification(true);
      }
    } catch (error) {
      console.log('Update check error (this is normal if GitHub is unreachable):', error);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, new Date().toDateString());
    setShowNotification(false);
  }, []);

  const pollUpdateStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/update/status');
      if (response.ok) {
        const status: UpdateStatus = await response.json();
        setUpdateStatus(status);

        if (status.status === 'complete' || status.status === 'error') {
          setIsUpdating(false);
          if (status.status === 'complete' && status.message.includes('Restarting')) {
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }
        }

        return status.status;
      }
    } catch {
      setUpdateStatus({
        status: 'restarting',
        message: 'Application is restarting with the new version...',
        progress: 95,
      });
      setTimeout(() => {
        window.location.reload();
      }, 5000);
      return 'restarting';
    }
    return 'idle';
  }, []);

  const startUpdate = useCallback(async () => {
    setIsUpdating(true);
    setUpdateStatus({
      status: 'checking',
      message: 'Starting update...',
      progress: 0,
    });

    try {
      const response = await fetch('/api/update/apply', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to start update');
      }

      const poll = async () => {
        const status = await pollUpdateStatus();
        if (status !== 'complete' && status !== 'error' && status !== 'idle') {
          setTimeout(poll, 1000);
        }
      };
      setTimeout(poll, 1000);
    } catch (error) {
      setIsUpdating(false);
      setUpdateStatus({
        status: 'error',
        message: 'Failed to start update',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [pollUpdateStatus]);

  const startRollback = useCallback(async () => {
    setIsUpdating(true);
    setUpdateStatus({
      status: 'rolling-back',
      message: 'Starting rollback...',
      progress: 0,
    });

    try {
      const response = await fetch('/api/update/rollback', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to start rollback');
      }

      const poll = async () => {
        const status = await pollUpdateStatus();
        if (status !== 'complete' && status !== 'error' && status !== 'idle') {
          setTimeout(poll, 1000);
        }
      };
      setTimeout(poll, 1000);
    } catch (error) {
      setIsUpdating(false);
      setUpdateStatus({
        status: 'error',
        message: 'Failed to start rollback',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [pollUpdateStatus]);

  useEffect(() => {
    if (shouldCheckNow()) {
      checkForUpdates();
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const timeoutId = setTimeout(() => {
      const nextCheck = getNextCheckTime();
      const msUntilCheck = nextCheck.getTime() - Date.now();
      console.log(`Next version check scheduled for ${nextCheck.toLocaleString()}`);

      setTimeout(() => {
        checkForUpdates();
        intervalId = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
      }, msUntilCheck);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkForUpdates]);

  useEffect(() => {
    if (updateAvailable && !isDismissedToday()) {
      setShowNotification(true);
    }
  }, [updateAvailable]);

  return {
    updateAvailable,
    latestVersion,
    releaseNotes,
    releaseName,
    releaseUrl,
    checkForUpdates,
    dismissUpdate,
    showUpdateNotification: showNotification,
    startUpdate,
    startRollback,
    updateStatus,
    isUpdating,
  };
}
