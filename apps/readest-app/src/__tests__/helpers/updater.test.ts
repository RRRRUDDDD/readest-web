import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import semver from 'semver';

const mockSetUpdaterWindowVisible = vi.fn();
vi.mock('@/components/UpdaterWindow', () => ({
  setUpdaterWindowVisible: (...args: unknown[]) => mockSetUpdaterWindowVisible(...args),
}));

let mockAppVersion = '1.0.0';
vi.mock('@/utils/version', () => ({
  getAppVersion: () => mockAppVersion,
}));

vi.mock('@/services/constants', () => ({
  CHECK_UPDATE_INTERVAL_SEC: 86400,
  READEST_CHANGELOG_FILE: 'https://example.com/release-notes.json',
}));

import {
  checkForAppUpdates,
  checkAppReleaseNotes,
  setLastShownReleaseNotesVersion,
  getLastShownReleaseNotesVersion,
} from '@/helpers/updater';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockAppVersion = '1.0.0';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const dummyTranslate = (key: string) => key;

describe('updater', () => {
  describe('release notes version tracking', () => {
    test('getLastShownReleaseNotesVersion returns empty string when not set', () => {
      expect(getLastShownReleaseNotesVersion()).toBe('');
    });

    test('setLastShownReleaseNotesVersion stores value in localStorage', () => {
      setLastShownReleaseNotesVersion('2.0.0');
      expect(getLastShownReleaseNotesVersion()).toBe('2.0.0');
    });

    test('overwrites previous value', () => {
      setLastShownReleaseNotesVersion('1.0.0');
      setLastShownReleaseNotesVersion('2.0.0');
      expect(getLastShownReleaseNotesVersion()).toBe('2.0.0');
    });
  });

  describe('checkForAppUpdates', () => {
    test('skips check when auto-check interval has not elapsed', async () => {
      localStorage.setItem('lastAppUpdateCheck', Date.now().toString());

      const result = await checkForAppUpdates(dummyTranslate, true);

      expect(result).toBe(false);
    });

    test('records a check timestamp and returns false for the pure web build', async () => {
      const before = Date.now();
      const result = await checkForAppUpdates(dummyTranslate, false);
      const after = Date.now();

      expect(result).toBe(false);
      const stored = parseInt(localStorage.getItem('lastAppUpdateCheck')!, 10);
      expect(stored).toBeGreaterThanOrEqual(before);
      expect(stored).toBeLessThanOrEqual(after);
    });
  });

  describe('checkAppReleaseNotes', () => {
    test('shows release notes when current version is newer than last shown', async () => {
      mockAppVersion = '2.0.0';
      setLastShownReleaseNotesVersion('1.0.0');

      const mockFetchFn = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetchFn);

      const result = await checkAppReleaseNotes(true);

      expect(result).toBe(true);
      expect(mockSetUpdaterWindowVisible).toHaveBeenCalledWith(true, '2.0.0', '1.0.0', false);
    });

    test('returns false when current version equals last shown', async () => {
      mockAppVersion = '1.0.0';
      setLastShownReleaseNotesVersion('1.0.0');

      const result = await checkAppReleaseNotes(true);

      expect(result).toBe(false);
    });

    test('sets current version as last shown when no previous version recorded', async () => {
      mockAppVersion = '1.5.0';

      const result = await checkAppReleaseNotes(true);

      expect(result).toBe(false);
      expect(getLastShownReleaseNotesVersion()).toBe('1.5.0');
    });

    test('shows release notes when isAutoCheck is false regardless of version comparison', async () => {
      mockAppVersion = '1.0.0';
      setLastShownReleaseNotesVersion('1.0.0');

      const mockFetchFn = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetchFn);

      const result = await checkAppReleaseNotes(false);

      expect(result).toBe(true);
      expect(mockSetUpdaterWindowVisible).toHaveBeenCalled();
    });

    test('returns false when fetch fails', async () => {
      mockAppVersion = '2.0.0';
      setLastShownReleaseNotesVersion('1.0.0');

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await checkAppReleaseNotes(true);

      expect(result).toBe(false);
    });

    test('returns false when fetch response is not ok', async () => {
      mockAppVersion = '2.0.0';
      setLastShownReleaseNotesVersion('1.0.0');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

      const result = await checkAppReleaseNotes(true);

      expect(result).toBe(false);
    });
  });

  describe('semver gt (sanity checks for the logic used)', () => {
    test('2.0.0 is greater than 1.0.0', () => {
      expect(semver.gt('2.0.0', '1.0.0')).toBe(true);
    });

    test('1.0.0 is not greater than 2.0.0', () => {
      expect(semver.gt('1.0.0', '2.0.0')).toBe(false);
    });

    test('equal versions return false', () => {
      expect(semver.gt('1.0.0', '1.0.0')).toBe(false);
    });
  });
});
