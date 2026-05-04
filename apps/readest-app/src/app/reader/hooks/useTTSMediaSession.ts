import { useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SILENCE_DATA } from '@/services/tts';
import { getMediaSession } from '@/libs/mediaSession';

interface UseTTSMediaSessionProps {
  bookKey: string;
}

export const useTTSMediaSession = ({ bookKey: _bookKey }: UseTTSMediaSessionProps) => {
  const _ = useTranslation();
  void _;
  void useSettingsStore;
  void useBookDataStore;
  void useReaderStore;

  const mediaSessionRef = useRef<MediaSession | null>(null);
  const unblockerAudioRef = useRef<HTMLAudioElement | null>(null);

  // this enables WebAudio to play even when the mute toggle switch is ON
  const unblockAudio = () => {
    if (unblockerAudioRef.current) return;
    unblockerAudioRef.current = document.createElement('audio');
    unblockerAudioRef.current.setAttribute('x-webkit-airplay', 'deny');
    unblockerAudioRef.current.addEventListener('play', () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });
    unblockerAudioRef.current.preload = 'auto';
    unblockerAudioRef.current.loop = true;
    unblockerAudioRef.current.src = SILENCE_DATA;
    unblockerAudioRef.current.play();
  };

  const releaseUnblockAudio = () => {
    if (!unblockerAudioRef.current) return;
    try {
      unblockerAudioRef.current.pause();
      unblockerAudioRef.current.currentTime = 0;
      unblockerAudioRef.current.removeAttribute('src');
      unblockerAudioRef.current.src = '';
      unblockerAudioRef.current.load();
      unblockerAudioRef.current = null;
      console.log('Unblock audio released');
    } catch (err) {
      console.warn('Error releasing unblock audio:', err);
    }
  };

  const initMediaSession = async () => {
    const mediaSession = getMediaSession();
    if (!mediaSession) return;

    // Only the browser's `navigator.mediaSession` API is reachable from the
    // web build. Setting metadata/active on it requires direct property
    // assignment, which is handled by the consumer that owns the audio
    // element. Keep the ref so callers can dispatch actions if needed.
    mediaSessionRef.current = mediaSession;
  };

  const deinitMediaSession = async () => {
    mediaSessionRef.current = null;
  };

  return {
    mediaSessionRef,
    unblockerAudioRef,
    unblockAudio,
    releaseUnblockAudio,
    initMediaSession,
    deinitMediaSession,
  };
};
