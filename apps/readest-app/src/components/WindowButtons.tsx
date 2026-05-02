import clsx from 'clsx';
import React, { useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { handleClose as closeWindow, handleMinimize, handleToggleMaximize } from '@/utils/window';
import { useTranslation } from '@/hooks/useTranslation';

interface WindowButtonsProps {
  className?: string;
  headerRef?: React.RefObject<HTMLDivElement | null>;
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  closeButtonLabel?: string;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

interface WindowButtonProps {
  id: string;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

const WindowButton: React.FC<WindowButtonProps> = ({ onClick, label, id, children }) => (
  <button
    id={id}
    onClick={onClick}
    className='window-button bg-base-200/35 hover:bg-base-200 text-base-content/85 hover:text-base-content'
    aria-label={label}
  >
    {children}
  </button>
);

const WindowButtons: React.FC<WindowButtonsProps> = ({
  className,
  showMinimize = true,
  showMaximize = true,
  showClose = true,
  closeButtonLabel,
  onMinimize,
  onToggleMaximize,
  onClose,
}) => {
  const _ = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const { appService } = useEnv();

  const onMinimizeClick = async () => {
    if (onMinimize) {
      onMinimize();
    } else {
      handleMinimize();
    }
  };

  const onMaximizeClick = async () => {
    if (onToggleMaximize) {
      onToggleMaximize();
    } else {
      handleToggleMaximize();
    }
  };

  const onCloseClick = async () => {
    if (onClose) {
      onClose();
    } else {
      closeWindow();
    }
  };

  return (
    <div
      ref={parentRef}
      className={clsx(
        'window-buttons flex h-8 items-center justify-end space-x-2',
        showClose || showMaximize || showMinimize ? 'visible' : 'hidden',
        className,
      )}
    >
      {showMinimize && appService?.hasWindowBar && (
        <WindowButton onClick={onMinimizeClick} label={_('Minimize')} id='titlebar-minimize'>
          <svg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'>
            <path fill='currentColor' d='M20 14H4v-2h16' />
          </svg>
        </WindowButton>
      )}

      {showMaximize && appService?.hasWindowBar && (
        <WindowButton
          onClick={onMaximizeClick}
          label={_('Maximize or Restore')}
          id='titlebar-maximize'
        >
          <svg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'>
            <path fill='currentColor' d='M4 4h16v16H4zm2 4v10h12V8z' />
          </svg>
        </WindowButton>
      )}

      {showClose && (appService?.hasWindowBar || onClose) && (
        <WindowButton
          onClick={onCloseClick}
          label={closeButtonLabel || _('Close')}
          id='titlebar-close'
        >
          <svg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'>
            <path
              fill='currentColor'
              d='M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z'
            />
          </svg>
        </WindowButton>
      )}
    </div>
  );
};

export default WindowButtons;
