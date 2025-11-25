import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION, VERSION_CHECK_URL } from '@shared/version';

interface VersionCheckResult {
  updateAvailable: boolean;
  latestVersion: string | null;
  checkForUpdates: () => Promise<void>;
  dismissUpdate: () => void;
  showUpdateNotification: boolean;
}

const DISMISS_KEY = 'update-dismissed-date';
const LAST_CHECK_KEY = 'version-last-check';

function compareVersions(current: string, latest: string): boolean {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  
  return false;
}

function isDismissedToday(): boolean {
  const dismissedDate = localStorage.getItem(DISMISS_KEY);
  if (!dismissedDate) return false;
  
  const today = new Date().toDateString();
  return dismissedDate === today;
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

export function useVersionCheck(): VersionCheckResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      console.log('Checking for updates...');
      const response = await fetch(VERSION_CHECK_URL, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
      });
      
      if (!response.ok) {
        console.log('Version check failed:', response.status);
        return;
      }
      
      const data = await response.json();
      const remoteVersion = data.version;
      
      console.log(`Current version: ${APP_VERSION}, Remote version: ${remoteVersion}`);
      
      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
      
      const hasUpdate = compareVersions(APP_VERSION, remoteVersion);
      setLatestVersion(remoteVersion);
      setUpdateAvailable(hasUpdate);
      
      if (hasUpdate && !isDismissedToday()) {
        setShowNotification(true);
      }
    } catch (error) {
      console.log('Version check error (this is normal if running locally):', error);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, new Date().toDateString());
    setShowNotification(false);
  }, []);

  useEffect(() => {
    if (shouldCheckNow()) {
      checkForUpdates();
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    const scheduleNextCheck = () => {
      const nextCheck = getNextCheckTime();
      const msUntilCheck = nextCheck.getTime() - Date.now();
      
      console.log(`Next version check scheduled for ${nextCheck.toLocaleString()}`);
      
      return setTimeout(() => {
        checkForUpdates();
        intervalId = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
      }, msUntilCheck);
    };

    const timeoutId = scheduleNextCheck();
    
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
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
    checkForUpdates,
    dismissUpdate,
    showUpdateNotification: showNotification,
  };
}
