import { useUser } from '@clerk/react-router';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MAX_IMAGE_ATTACHMENTS = 4;
// Keep this aligned with the serverless limit. Data URLs are base64 encoded,
// so the final JSON request is larger than the original files.
export const MAX_HOSTED_FILE_BYTES = 2 * 1024 * 1024;

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('File could not be read.'));
    reader.readAsDataURL(file);
  });

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
