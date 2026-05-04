import clsx from 'clsx';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiUserCircle, PiUserCircleCheck, PiGear } from 'react-icons/pi';
import { PiSun, PiMoon } from 'react-icons/pi';
import { TbSunMoon } from 'react-icons/tb';
import { MdCloudSync, MdSync, MdSyncProblem } from 'react-icons/md';

import { setBackupDialogVisible } from '@/app/library/components/BackupWindow';
import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTransferQueue } from '@/hooks/useTransferQueue';
import { navigateToLogin, navigateToProfile } from '@/utils/nav';
import { handleSetAlwaysOnTop, handleToggleFullScreen } from '@/utils/window';
import { requestStoragePermission } from '@/utils/permission';
import { saveSysSettings } from '@/helpers/settings';
import { selectDirectory } from '@/utils/bridge';
import { formatLocaleDateTime } from '@/utils/book';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';

interface SettingsMenuProps {
  onPullLibrary: (fullRefresh?: boolean, verbose?: boolean) => void;
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onPullLibrary, setIsDropdownOpen }) => {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { user } = useAuth();
  const { themeMode, setThemeMode } = useThemeStore();
  const { settings, setSettingsDialogOpen } = useSettingsStore();
  const [isAutoUpload, setIsAutoUpload] = useState(settings.autoUpload);
  const [isAutoCheckUpdates, setIsAutoCheckUpdates] = useState(settings.autoCheckUpdates);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(settings.alwaysOnTop);
  const [isAlwaysShowStatusBar, setIsAlwaysShowStatusBar] = useState(settings.alwaysShowStatusBar);
  const [alwaysInForeground, setAlwaysInForeground] = useState(settings.alwaysInForeground);
  const [savedBookCoverForLockScreen, setSavedBookCoverForLockScreen] = useState(
    settings.savedBookCoverForLockScreen || '',
  );
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const [refreshMetadataProgress, setRefreshMetadataProgress] = useState('');
  const { isSyncing, setLibrary } = useLibraryStore();
  const { stats, hasActiveTransfers, setIsTransferQueueOpen } = useTransferQueue();

  const openTransferQueue = () => {
    setIsTransferQueueOpen(true);
    setIsDropdownOpen?.(false);
  };

  const handleUserLogin = () => {
    navigateToLogin(router);
    setIsDropdownOpen?.(false);
  };

  const handleUserProfile = () => {
    navigateToProfile(router);
    setIsDropdownOpen?.(false);
  };

  const cycleThemeMode = () => {
    const nextMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
    setThemeMode(nextMode);
  };

  const handleReloadPage = () => {
    window.location.reload();
    setIsDropdownOpen?.(false);
  };

  const handleFullScreen = () => {
    handleToggleFullScreen();
    setIsDropdownOpen?.(false);
  };

  const toggleOpenInNewWindow = () => {
    saveSysSettings(envConfig, 'openBookInNewWindow', !settings.openBookInNewWindow);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysOnTop = () => {
    const newValue = !settings.alwaysOnTop;
    saveSysSettings(envConfig, 'alwaysOnTop', newValue);
    setIsAlwaysOnTop(newValue);
    handleSetAlwaysOnTop(newValue);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysShowStatusBar = () => {
    const newValue = !settings.alwaysShowStatusBar;
    saveSysSettings(envConfig, 'alwaysShowStatusBar', newValue);
    setIsAlwaysShowStatusBar(newValue);
  };

  const toggleAutoUploadBooks = () => {
    const newValue = !settings.autoUpload;
    saveSysSettings(envConfig, 'autoUpload', newValue);
    setIsAutoUpload(newValue);

    if (newValue && !user) {
      navigateToLogin(router);
    }
  };

  const toggleAutoCheckUpdates = () => {
    const newValue = !settings.autoCheckUpdates;
    saveSysSettings(envConfig, 'autoCheckUpdates', newValue);
    setIsAutoCheckUpdates(newValue);
  };

  const handleSetRootDir = () => {
    // The web build cannot relocate its data directory (the data lives in
    // IndexedDB / Cache Storage), so this menu item is hidden behind
    // `appService?.canCustomizeRootDir`, which is `false` on web. The handler
    // is kept as a no-op so future native builds can reuse the menu wiring.
    setIsDropdownOpen?.(false);
  };

  const handleBackupRestore = () => {
    setIsDropdownOpen?.(false);
    setBackupDialogVisible(true);
  };

  const handleRefreshMetadata = async () => {
    if (!appService || isRefreshingMetadata) return;
    setIsRefreshingMetadata(true);
    setRefreshMetadataProgress(_('Loading library...'));
    try {
      const books = await appService.loadLibraryBooks();
      const activeBooks = books.filter((b) => !b.deletedAt);
      let refreshed = 0;
      for (let i = 0; i < activeBooks.length; i++) {
        setRefreshMetadataProgress(`${i + 1} / ${activeBooks.length}`);
        try {
          if (await appService.refreshBookMetadata(activeBooks[i]!)) {
            refreshed++;
          }
        } catch {
          // Skip books whose files can't be opened
        }
      }
      setLibrary(books);
      await appService.saveLibraryBooks(books);
      setRefreshMetadataProgress(_('{{count}} books refreshed', { count: refreshed }));
      onPullLibrary(true);
      setTimeout(() => {
        setIsRefreshingMetadata(false);
        setRefreshMetadataProgress('');
      }, 2000);
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
      setRefreshMetadataProgress(_('Failed to refresh metadata'));
      setTimeout(() => {
        setIsRefreshingMetadata(false);
        setRefreshMetadataProgress('');
      }, 2000);
    }
  };

  const openSettingsDialog = () => {
    setIsDropdownOpen?.(false);
    setSettingsDialogOpen(true);
  };

  const handleSetSavedBookCoverForLockScreen = async () => {
    if (!(await requestStoragePermission()) && appService?.distChannel === 'readest') return;

    const newValue = settings.savedBookCoverForLockScreen ? '' : 'default';
    if (newValue) {
      const response = await selectDirectory();
      if (response.path) {
        saveSysSettings(envConfig, 'savedBookCoverForLockScreenPath', response.path);
      }
    }
    saveSysSettings(envConfig, 'savedBookCoverForLockScreen', newValue);
    setSavedBookCoverForLockScreen(newValue);
  };

  const toggleAlwaysInForeground = async () => {
    // Background-mode toggling requires the Android Tauri `native-tts` plugin
    // and is gated behind `appService?.isAndroidApp`, which is always `false`
    // on the web build. The handler is kept as a no-op so future native
    // builds can reuse the menu wiring.
    saveSysSettings(envConfig, 'alwaysInForeground', !settings.alwaysInForeground);
    setAlwaysInForeground(!settings.alwaysInForeground);
  };

  const handleSyncLibrary = () => {
    onPullLibrary(true, true);
    setIsDropdownOpen?.(false);
  };

  const themeModeLabel =
    themeMode === 'dark'
      ? _('Dark Mode')
      : themeMode === 'light'
        ? _('Light Mode')
        : _('Auto Mode');

  const savedBookCoverPath = settings.savedBookCoverForLockScreenPath;
  const coverDir = savedBookCoverPath ? savedBookCoverPath.split('/').pop() : 'Images';
  const savedBookCoverDescription = `💾 ${coverDir}/last-book-cover.png`;

  return (
    <Menu
      className={clsx(
        'settings-menu dropdown-content no-triangle',
        'z-20 mt-2 max-w-[90vw] shadow-2xl',
      )}
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      {user ? (
        <MenuItem
          label={_('Manage Storage')}
          labelClass='!max-w-40'
          aria-label={_('Manage Storage')}
          Icon={PiUserCircleCheck}
        >
          <ul className='ms-0 flex flex-col ps-0 before:hidden'>
            <MenuItem
              label={_('Cloud File Transfers')}
              Icon={MdCloudSync}
              description={
                hasActiveTransfers
                  ? _('{{activeCount}} active, {{pendingCount}} pending', {
                      activeCount: stats.active,
                      pendingCount: stats.pending,
                    })
                  : stats.failed > 0
                    ? _('{{failedCount}} failed', { failedCount: stats.failed })
                    : ''
              }
              onClick={openTransferQueue}
            />
            <MenuItem
              label={
                settings.lastSyncedAtBooks
                  ? _('Synced at {{time}}', {
                      time: formatLocaleDateTime(settings.lastSyncedAtBooks),
                    })
                  : _('Never synced')
              }
              Icon={user ? MdSync : MdSyncProblem}
              labelClass='ps-2 pe-1 !mx-0'
              iconClassName={user && isSyncing ? 'animate-reverse-spin' : ''}
              onClick={handleSyncLibrary}
            />
            <MenuItem label={_('Manage Storage')} onClick={handleUserProfile} />
          </ul>
        </MenuItem>
      ) : (
        <MenuItem label={_('Sign In')} Icon={PiUserCircle} onClick={handleUserLogin}></MenuItem>
      )}

      <MenuItem
        label={_('Auto Upload Books to Cloud')}
        toggled={isAutoUpload}
        onClick={toggleAutoUploadBooks}
      />

      {appService?.hasUpdater && (
        <MenuItem
          label={_('Check Updates on Start')}
          toggled={isAutoCheckUpdates}
          onClick={toggleAutoCheckUpdates}
        />
      )}
      <hr aria-hidden='true' className='border-base-200 my-1' />
      {appService?.hasWindow && (
        <MenuItem
          label={_('Open Book in New Window')}
          toggled={settings.openBookInNewWindow}
          onClick={toggleOpenInNewWindow}
        />
      )}
      {appService?.hasWindow && <MenuItem label={_('Fullscreen')} onClick={handleFullScreen} />}
      {appService?.hasWindow && (
        <MenuItem label={_('Always on Top')} toggled={isAlwaysOnTop} onClick={toggleAlwaysOnTop} />
      )}
      {appService?.isMobileApp && (
        <MenuItem
          label={_('Always Show Status Bar')}
          toggled={isAlwaysShowStatusBar}
          onClick={toggleAlwaysShowStatusBar}
        />
      )}
      {appService?.isAndroidApp && (
        <MenuItem
          label={_(_('Background Read Aloud'))}
          toggled={alwaysInForeground}
          onClick={toggleAlwaysInForeground}
        />
      )}
      <MenuItem label={_('Reload Page')} onClick={handleReloadPage} />
      <MenuItem
        label={themeModeLabel}
        Icon={themeMode === 'dark' ? PiMoon : themeMode === 'light' ? PiSun : TbSunMoon}
        onClick={cycleThemeMode}
      />
      <MenuItem label={_('Settings')} Icon={PiGear} onClick={openSettingsDialog} />
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem label={_('Advanced Settings')}>
        <ul className='ms-0 flex flex-col ps-0 before:hidden'>
          {appService?.canCustomizeRootDir && (
            <MenuItem label={_('Change Data Location')} onClick={handleSetRootDir} />
          )}
          <MenuItem label={_('Backup & Restore')} onClick={handleBackupRestore} />
          <MenuItem
            label={_('Refresh Metadata')}
            description={refreshMetadataProgress}
            onClick={handleRefreshMetadata}
            disabled={isRefreshingMetadata}
          />
          {appService?.isAndroidApp && appService?.distChannel !== 'playstore' && (
            <MenuItem
              label={_('Save Book Cover')}
              tooltip={_('Auto-save last book cover')}
              description={savedBookCoverForLockScreen ? savedBookCoverDescription : ''}
              toggled={!!savedBookCoverForLockScreen}
              onClick={handleSetSavedBookCoverForLockScreen}
            />
          )}
        </ul>
      </MenuItem>
    </Menu>
  );
};

export default SettingsMenu;
