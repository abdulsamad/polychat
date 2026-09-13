import { useUser } from '@clerk/react-router';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const speechLog = (text: string, styles?: React.CSSProperties) => {
  const defaultStyles = {
    fontSize: '12px',
    color: '#e3e3e3',
  };

  const labelStyles = {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#2196F3',
  };

  const mergedStyles = {
    ...defaultStyles,
    ...styles,
  };

  console.log(
    `%cSPEECH RECOGNITION: %c${text}`,
    Object.entries(labelStyles)
      .map(([key, value]) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value}`)
      .join(';'),
    Object.entries(mergedStyles)
      .map(([key, value]) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value}`)
      .join(';')
  );
};

export const speechGrammer =
  '#JSGF V1.0; grammar colors; public <color> = aqua | azure | black | orange ;';

export const isClient = typeof window !== 'undefined';

export const IS_SPEECH_RECOGNITION_SUPPORTED = () =>
  isClient && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

export const IS_SPEECH_SYNTHESIS_SUPPORTED = () => isClient && 'speechSynthesis' in window;

export const getName = (user: ReturnType<typeof useUser>['user']) => {
  if (!user) return 'User';

  return user?.fullName || user.firstName || user.emailAddresses[0].emailAddress.split('@')[0];
};
