'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';

const USERNAME_EMAILS: Record<string, string> = {
  wjy: 'wjy@readest-web.pages.dev',
};

export default function AuthPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const { envConfig } = useEnv();
  const { isDarkMode } = useThemeStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const [isMounted, setIsMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useTheme({ systemUIVisible: false });

  const handleGoBack = () => {
    settings.keepLogin = false;
    setSettings(settings);
    saveSettings(envConfig, settings);
    const redirectTo = new URLSearchParams(window.location.search).get('redirect');
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.back();
    }
  };

  const resolveLoginEmail = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return USERNAME_EMAILS[normalized];
  };

  const handlePasswordSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const email = resolveLoginEmail(username);
    if (!email) {
      setError(_('Invalid username or password'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session || !data.user) {
        setError(_('Invalid username or password'));
        return;
      }

      login(data.session.access_token, data.user);
      const redirectTo = new URLSearchParams(window.location.search).get('redirect');
      router.push(redirectTo ?? '/library');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && session.user) {
        login(session.access_token, session.user);
        const redirectTo = new URLSearchParams(window.location.search).get('redirect');
        const lastRedirectAtKey = 'lastRedirectAt';
        const lastRedirectAt = parseInt(localStorage.getItem(lastRedirectAtKey) || '0', 10);
        const now = Date.now();
        localStorage.setItem(lastRedirectAtKey, now.toString());
        if (now - lastRedirectAt > 3000) {
          router.push(redirectTo ?? '/library');
        }
      }
    });

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, [login, router]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div style={{ maxWidth: '420px', margin: 'auto', padding: '2rem', paddingTop: '4rem' }}>
      <button
        aria-label={_('Go Back')}
        onClick={handleGoBack}
        className='btn btn-ghost fixed left-6 top-6 h-8 min-h-8 w-8 p-0'
      >
        <IoArrowBack className='text-base-content' />
      </button>
      <form
        onSubmit={handlePasswordSignIn}
        className='flex flex-col gap-4'
        data-theme={isDarkMode ? 'dark' : 'light'}
      >
        <div className='form-control'>
          <label className='label' htmlFor='username'>
            <span className='label-text'>{_('Username')}</span>
          </label>
          <input
            id='username'
            type='text'
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className='input input-bordered w-full'
            autoComplete='username'
            autoCapitalize='none'
            autoCorrect='off'
            spellCheck={false}
            required
          />
        </div>
        <div className='form-control'>
          <label className='label' htmlFor='password'>
            <span className='label-text'>{_('Your Password')}</span>
          </label>
          <input
            id='password'
            type='password'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className='input input-bordered w-full'
            autoComplete='current-password'
            required
          />
        </div>
        {error && <p className='text-error text-sm'>{error}</p>}
        <button
          type='submit'
          className='btn btn-primary mt-2 w-full'
          disabled={isSubmitting || !username.trim() || !password}
        >
          {isSubmitting ? _('Signing in...') : _('Sign in')}
        </button>
      </form>
    </div>
  );
}
