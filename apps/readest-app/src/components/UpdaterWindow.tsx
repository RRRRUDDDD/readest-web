import semver from 'semver';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTranslator } from '@/hooks/useTranslator';
import { useTranslation } from '@/hooks/useTranslation';
import { useSearchParams } from 'next/navigation';
import { getAppVersion } from '@/utils/version';
import { getLocale } from '@/utils/misc';
import { setLastShownReleaseNotesVersion } from '@/helpers/updater';
import { READEST_CHANGELOG_FILE } from '@/services/constants';
import Dialog from '@/components/Dialog';

interface ReleaseNotes {
  releases: Record<
    string,
    {
      date: string;
      notes: string[];
    }
  >;
}

interface Changelog {
  version: string;
  date: string;
  notes: string[];
}

export const UpdaterContent = ({
  latestVersion,
  lastVersion,
}: {
  latestVersion?: string;
  lastVersion?: string;
  // checkUpdate is kept in the API for backwards compatibility with callers
  // (e.g. the legacy /updater page) but the pure web build never has a
  // client-side binary updater, so it is ignored.
  checkUpdate?: boolean;
}) => {
  const _ = useTranslation();
  const [targetLang, setTargetLang] = useState('EN');
  const { translate } = useTranslator({
    provider: 'azure',
    sourceLang: 'AUTO',
    targetLang,
  });
  const searchParams = useSearchParams();
  const currentVersion = getAppVersion();
  const [newVersion, setNewVersion] = useState(
    latestVersion ?? searchParams?.get('latestVersion') ?? '',
  );
  const [oldVersion] = useState(lastVersion ?? searchParams?.get('lastVersion') ?? '');
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setTargetLang(getLocale());
  }, []);

  useEffect(() => {
    if (latestVersion) {
      setNewVersion(latestVersion);
    }
  }, [latestVersion]);

  useEffect(() => {
    const fetchChangelogs = async (fromVersion: string): Promise<Changelog[]> => {
      try {
        const res = await window.fetch(READEST_CHANGELOG_FILE);
        const data: ReleaseNotes = await res.json();
        const releases = data.releases;

        let entries = Object.entries(releases)
          .filter(([ver]) => semver.gt(ver, fromVersion))
          .sort(([a], [b]) => semver.rcompare(a, b));
        entries = entries.length ? entries : Object.entries(releases).slice(0, 3);
        return entries.map(([version, info]) => ({
          version,
          date: new Date(info.date).toLocaleDateString(),
          notes: info.notes,
        }));
      } catch (error) {
        console.error('Failed to fetch changelog:', error);
        return [];
      }
    };
    const updateChangelogs = async () => {
      const changelogs = await fetchChangelogs(oldVersion || currentVersion);
      if (!targetLang.toLowerCase().startsWith('en')) {
        for (const entry of changelogs) {
          try {
            entry.notes = await translate(entry.notes, { useCache: true });
          } catch (error) {
            console.log('Failed to translate changelog:', error);
          }
        }
      }

      setChangelogs(changelogs);
      setLastShownReleaseNotesVersion(newVersion || currentVersion);
    };
    updateChangelogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !newVersion) {
    return null;
  }

  return (
    <div className='bg-base-100 flex min-h-screen justify-center'>
      <div className='flex w-full max-w-2xl flex-col gap-4'>
        <div className='flex flex-col justify-center gap-4 sm:flex-row sm:items-start'>
          <div className='flex items-center justify-center'>
            <Image src='/icon.png' alt='Logo' className='h-20 w-20' width={64} height={64} />
          </div>
          <div className='text-base-content flex h-full flex-grow flex-col text-sm sm:flex-row'>
            <div className='flex flex-col items-center justify-center gap-4 p-1 sm:items-start sm:gap-2'>
              <h2 className='text-center font-bold sm:text-start'>
                {_('Version {{version}}', { version: currentVersion })}
              </h2>
              <div className='flex'>
                <p className='text-sm font-bold'>{_('Already the latest version')}</p>
              </div>
            </div>
          </div>
        </div>
        <div className='text-base-content text-sm'>
          <h3 className='mb-2 font-bold'>{_('Changelog')}</h3>
          <div className='not-eink:bg-base-200 not-eink:px-4 mb-4 rounded-lg pb-2 pt-4'>
            {changelogs.length > 0 ? (
              changelogs.map((entry: Changelog) => (
                <div key={entry.version} className='mb-4'>
                  <h4 className='mb-2 font-bold'>
                    {entry.version} ({entry.date})
                  </h4>
                  <ul className='list-disc space-y-1 ps-6 text-sm'>
                    {entry.notes.map((note: string, i: number) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <div className='flex h-56 w-full flex-col gap-4'>
                <div className='skeleton h-4 w-28'></div>
                <div className='skeleton h-4 w-full'></div>
                <div className='skeleton h-4 w-full'></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const setUpdaterWindowVisible = (
  visible: boolean,
  latestVersion: string,
  lastVersion?: string,
  // Kept for backwards compatibility with /helpers/updater.ts callers.
  checkUpdate = true,
) => {
  const dialog = document.getElementById('updater_window');
  if (dialog) {
    const event = new CustomEvent('setDialogVisibility', {
      detail: { visible, latestVersion, lastVersion, checkUpdate },
    });
    dialog.dispatchEvent(event);
  }
};

export const UpdaterWindow = () => {
  const _ = useTranslation();
  const [latestVersion, setLatestVersion] = useState('');
  const [lastVersion, setLastVersion] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      const { visible, latestVersion, lastVersion } = event.detail;
      setIsOpen(visible);
      if (latestVersion) {
        setLatestVersion(latestVersion);
      }
      if (lastVersion) {
        setLastVersion(lastVersion);
      }
    };

    const el = document.getElementById('updater_window');
    if (el) {
      el.addEventListener('setDialogVisibility', handleCustomEvent as EventListener);
    }

    return () => {
      if (el) {
        el.removeEventListener('setDialogVisibility', handleCustomEvent as EventListener);
      }
    };
  }, []);

  return (
    <Dialog
      id='updater_window'
      isOpen={isOpen}
      title={_("What's New in Readest")}
      onClose={() => setIsOpen(false)}
      boxClassName='sm:!w-[75%] sm:h-auto sm:!max-h-[85vh] sm:!max-w-2xl'
    >
      {isOpen && (
        <UpdaterContent
          latestVersion={latestVersion ?? undefined}
          lastVersion={lastVersion ?? undefined}
        />
      )}
    </Dialog>
  );
};
