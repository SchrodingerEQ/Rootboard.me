import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { APP_VERSION } from '@shared/version';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  zipball_url: string;
  tarball_url: string;
  html_url: string;
}

interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseName: string;
  publishedAt: string;
  downloadUrl: string;
  releaseUrl: string;
}

interface UpdateStatus {
  status: 'idle' | 'checking' | 'downloading' | 'backing-up' | 'extracting' | 'installing' | 'restarting' | 'complete' | 'error' | 'rolling-back';
  message: string;
  progress: number;
  error?: string;
}

const APP_ROOT = process.cwd();
const BACKUP_DIR = path.join(APP_ROOT, '.update-backups');
const TEMP_DIR = path.join(APP_ROOT, '.update-temp');

const PRESERVE_PATHS = [
  '.env',
  'data',
  'node_modules',
  '.update-backups',
  '.update-temp',
  // Self-hosted secrets and runtime data. These are gitignored, so they are
  // NOT contained in the GitHub release tarball. Without preserving them, a
  // *successful* update would delete them (applyFiles wipes everything not
  // listed here) and never restore them, breaking Google auth and wiping the
  // local database. See .gitignore.
  'service-account.json',
  'google_credentials.json',
  'calendar.db',
  'calendar.db-shm',
  'calendar.db-wal',
];

let currentStatus: UpdateStatus = {
  status: 'idle',
  message: 'No update in progress',
  progress: 0,
};

function setStatus(status: UpdateStatus['status'], message: string, progress: number, error?: string) {
  currentStatus = { status, message, progress, error };
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.replace(/^v/, '').split('.').map(Number);
  const l = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, { headers: { 'User-Agent': 'Rootboard-Calendar-Updater' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, { headers: { 'User-Agent': 'Rootboard-Calendar-Updater' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlinkSync(dest); reject(err); });
    }).on('error', (err) => { fs.unlinkSync(dest); reject(err); });
  });
}

function getGitHubConfig(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_REPO_OWNER || 'SchrodingerEQ';
  const repo = process.env.GITHUB_REPO_NAME || 'Rootboard.me';
  return { owner, repo };
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const { owner, repo } = getGitHubConfig();
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  try {
    const data = await httpsGet(apiUrl);
    const release: GitHubRelease = JSON.parse(data);
    const latestVersion = release.tag_name.replace(/^v/, '');

    return {
      updateAvailable: compareVersions(APP_VERSION, latestVersion),
      currentVersion: APP_VERSION,
      latestVersion,
      releaseNotes: release.body || 'No release notes available.',
      releaseName: release.name || `v${latestVersion}`,
      publishedAt: release.published_at,
      downloadUrl: release.tarball_url,
      releaseUrl: release.html_url,
    };
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return {
      updateAvailable: false,
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      releaseNotes: '',
      releaseName: '',
      publishedAt: '',
      downloadUrl: '',
      releaseUrl: '',
    };
  }
}

export function getUpdateStatus(): UpdateStatus {
  return { ...currentStatus };
}

export async function applyUpdate(): Promise<void> {
  if (currentStatus.status !== 'idle' && currentStatus.status !== 'error' && currentStatus.status !== 'complete') {
    throw new Error('An update is already in progress');
  }

  try {
    setStatus('checking', 'Checking for latest version...', 5);
    const updateInfo = await checkForUpdate();

    if (!updateInfo.updateAvailable) {
      setStatus('complete', 'Already up to date!', 100);
      return;
    }

    setStatus('backing-up', 'Creating backup of current version...', 15);
    await createBackup();

    setStatus('downloading', `Downloading v${updateInfo.latestVersion}...`, 30);
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    const tarballPath = path.join(TEMP_DIR, 'update.tar.gz');
    await downloadFile(updateInfo.downloadUrl, tarballPath);

    setStatus('extracting', 'Extracting update files...', 50);
    const extractDir = path.join(TEMP_DIR, 'extracted');
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`tar -xzf "${tarballPath}" -C "${extractDir}"`, { stdio: 'pipe' });

    const extractedContents = fs.readdirSync(extractDir);
    const sourceDir = extractedContents.length === 1
      ? path.join(extractDir, extractedContents[0])
      : extractDir;

    setStatus('extracting', 'Applying update files...', 60);
    applyFiles(sourceDir);

    setStatus('installing', 'Installing dependencies (this may take a few minutes)...', 70);
    try {
      await runStreamed('npm', ['install'], 'installing', 'Installing dependencies', 70, 80);
    } catch (installError) {
      console.error('npm install failed:', installError);
      setStatus('error', 'Failed to install dependencies. Rolling back...', 0, 'npm install failed');
      await rollback();
      throw new Error('npm install failed during update. Rolled back to previous version.');
    }

    setStatus('installing', 'Building application...', 80);
    try {
      await runStreamed('npm', ['run', 'build'], 'installing', 'Building application', 80, 90);
    } catch (buildError) {
      console.error('npm run build failed:', buildError);
      setStatus('error', 'Failed to build application. Rolling back...', 0, 'npm run build failed');
      await rollback();
      throw new Error('npm run build failed during update. Rolled back to previous version.');
    }

    setStatus('restarting', 'Update complete! Restarting application...', 90);

    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }

    setStatus('complete', `Successfully updated to v${updateInfo.latestVersion}! Restarting...`, 100);

    scheduleRestart('update');

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (currentStatus.status !== 'error') {
      setStatus('error', `Update failed: ${msg}`, 0, msg);
    }
    throw error;
  }
}

async function createBackup(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();

  while (backups.length >= 2) {
    const old = backups.pop()!;
    fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
  fs.mkdirSync(backupPath, { recursive: true });

  fs.writeFileSync(path.join(backupPath, 'version.txt'), APP_VERSION);

  const filesToBackup = fs.readdirSync(APP_ROOT).filter(f => {
    return !PRESERVE_PATHS.includes(f) &&
           !f.startsWith('.update-') &&
           f !== 'node_modules' &&
           f !== '.git';
  });

  for (const file of filesToBackup) {
    const src = path.join(APP_ROOT, file);
    const dest = path.join(backupPath, file);
    copyRecursive(src, dest);
  }

  console.log(`Backup created at ${backupPath}`);
}

function applyFiles(sourceDir: string): void {
  const currentFiles = fs.readdirSync(APP_ROOT).filter(f => {
    return !PRESERVE_PATHS.includes(f) &&
           !f.startsWith('.update-') &&
           f !== 'node_modules' &&
           f !== '.git' &&
           f !== '.replit' &&
           f !== 'replit.nix' &&
           f !== 'replit.md';
  });

  for (const file of currentFiles) {
    const filePath = path.join(APP_ROOT, file);
    fs.rmSync(filePath, { recursive: true });
  }

  const newFiles = fs.readdirSync(sourceDir).filter(f => {
    return !PRESERVE_PATHS.includes(f) &&
           f !== 'node_modules' &&
           f !== '.git' &&
           f !== '.env' &&
           f !== '.replit' &&
           f !== 'replit.nix' &&
           f !== 'replit.md' &&
           f !== 'data';
  });

  for (const file of newFiles) {
    const src = path.join(sourceDir, file);
    const dest = path.join(APP_ROOT, file);
    copyRecursive(src, dest);
  }
}

function copyRecursive(src: string, dest: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

export async function rollback(): Promise<{ success: boolean; restoredVersion: string }> {
  setStatus('rolling-back', 'Rolling back to previous version...', 10);

  if (!fs.existsSync(BACKUP_DIR)) {
    setStatus('error', 'No backups available', 0, 'No backups found');
    throw new Error('No backups available for rollback');
  }

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    setStatus('error', 'No backups available', 0, 'No backups found');
    throw new Error('No backups available for rollback');
  }

  const latestBackup = path.join(BACKUP_DIR, backups[0]);
  const versionFile = path.join(latestBackup, 'version.txt');
  const restoredVersion = fs.existsSync(versionFile)
    ? fs.readFileSync(versionFile, 'utf-8').trim()
    : 'unknown';

  setStatus('rolling-back', `Restoring version ${restoredVersion}...`, 30);

  const currentFiles = fs.readdirSync(APP_ROOT).filter(f => {
    return !PRESERVE_PATHS.includes(f) &&
           !f.startsWith('.update-') &&
           f !== 'node_modules' &&
           f !== '.git' &&
           f !== '.replit' &&
           f !== 'replit.nix' &&
           f !== 'replit.md';
  });

  for (const file of currentFiles) {
    fs.rmSync(path.join(APP_ROOT, file), { recursive: true });
  }

  setStatus('rolling-back', 'Restoring files...', 50);

  const backupFiles = fs.readdirSync(latestBackup).filter(f => f !== 'version.txt');
  for (const file of backupFiles) {
    copyRecursive(path.join(latestBackup, file), path.join(APP_ROOT, file));
  }

  setStatus('installing', 'Reinstalling dependencies...', 70);
  try {
    await runStreamed('npm', ['install'], 'installing', 'Reinstalling dependencies', 70, 85);
  } catch (e) {
    console.error('npm install during rollback failed:', e);
  }

  setStatus('installing', 'Rebuilding application...', 85);
  try {
    await runStreamed('npm', ['run', 'build'], 'installing', 'Rebuilding application', 85, 100);
  } catch (e) {
    console.error('npm run build during rollback failed:', e);
  }

  setStatus('complete', `Rolled back to version ${restoredVersion}. Restarting...`, 100);

  scheduleRestart('rollback');

  return { success: true, restoredVersion };
}

/**
 * Spawn a child process and stream its stdout/stderr into the live update
 * status. Replaces execSync (which blocks the event loop and gives the user
 * no feedback during 1-3 minute npm install runs on a Pi). The `progressFrom`
 * → `progressTo` range is updated based on output line count for a rough
 * progress signal.
 */
function runStreamed(
  cmd: string,
  args: string[],
  status: UpdateStatus['status'],
  label: string,
  progressFrom: number,
  progressTo: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: APP_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let lineCount = 0;
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split('\n').filter(Boolean);
      lineCount += lines.length;
      // Cap progress at progressTo - 1 until the process exits cleanly.
      const advance = Math.min(progressTo - progressFrom - 1, Math.floor(lineCount / 10));
      const lastLine = lines[lines.length - 1] || label;
      const trimmed = lastLine.length > 80 ? lastLine.slice(0, 77) + '...' : lastLine;
      setStatus(status, `${label}: ${trimmed}`, progressFrom + Math.max(0, advance));
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} ${args.join(' ')} timed out after 5 minutes`));
    }, 5 * 60 * 1000);

    child.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on('exit', code => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

/**
 * Exit the process so a supervisor (start.sh on the Pi, systemd, pm2, etc.)
 * can restart us with the new code. If we detect we are NOT under a
 * supervisor (no MANAGED_BY_SUPERVISOR env var and not a child of init/systemd),
 * we surface a clear warning instead of silently exit-locking the kiosk.
 */
function scheduleRestart(reason: string) {
  const supervised =
    process.env.MANAGED_BY_SUPERVISOR === '1' ||
    process.env.SUPERVISED === '1' ||
    process.env.PM2_HOME !== undefined ||
    process.env.INVOCATION_ID !== undefined; // systemd sets this

  if (!supervised) {
    const warn = `Update applied (${reason}), but no supervisor detected (MANAGED_BY_SUPERVISOR not set). ` +
      `The app will NOT auto-restart — start it with scripts/start.sh, systemd, or pm2 to enable auto-restart.`;
    console.warn(warn);
    setStatus(
      'complete',
      `Update applied — please restart the app manually. (No supervisor detected.)`,
      100,
      warn,
    );
    return;
  }

  setTimeout(() => {
    console.log(`Restarting application after ${reason} (supervisor will respawn)...`);
    process.exit(0);
  }, 2000);
}

export function getAvailableBackups(): Array<{ name: string; version: string; date: string }> {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse()
    .map(name => {
      const backupPath = path.join(BACKUP_DIR, name);
      const versionFile = path.join(backupPath, 'version.txt');
      const version = fs.existsSync(versionFile)
        ? fs.readFileSync(versionFile, 'utf-8').trim()
        : 'unknown';
      const dateStr = name.replace('backup-', '').replace(/-/g, (m, offset) => {
        if (offset === 10) return 'T';
        if (offset === 13 || offset === 16) return ':';
        return m;
      });
      return { name, version, date: dateStr };
    });
}
