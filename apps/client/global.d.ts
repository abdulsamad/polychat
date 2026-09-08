// react-copy-to-clipboard
declare module 'react-copy-to-clipboard' {
  import * as React from 'react';

  interface CopyToClipboardProps {
    children: React.ReactNode;
    text: string;
    onCopy?: (text: string, result: boolean) => void;
  }

  export class CopyToClipboard extends React.Component<CopyToClipboardProps> {}
}
