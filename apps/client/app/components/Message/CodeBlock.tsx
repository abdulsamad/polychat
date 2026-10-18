import { DownloadIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { PrismAsync as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';

import { Button } from '@/components/ui/button';
import CopyButton from './CopyButton';

interface CodeBlockProps {
  code: string;
  filename?: string;
  index: number;
  language?: string;
}

const extensionByLanguage: Record<string, string> = {
  bash: 'sh',
  css: 'css',
  html: 'html',
  javascript: 'js',
  js: 'js',
  json: 'json',
  jsx: 'jsx',
  markdown: 'md',
  md: 'md',
  python: 'py',
  py: 'py',
  shell: 'sh',
  sql: 'sql',
  text: 'txt',
  ts: 'ts',
  tsx: 'tsx',
  typescript: 'ts',
  xml: 'xml',
  yaml: 'yml',
  yml: 'yml',
};

const safeFilename = (filename: string) => {
  const basename = filename.split(/[\\/]/).pop() || '';
  return basename
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/^\.+/, '')
    .trim();
};

const CodeBlock = ({ code, filename, index, language = 'text' }: CodeBlockProps) => {
  const normalizedLanguage = language.toLowerCase();
  const extension =
    extensionByLanguage[normalizedLanguage] ||
    (/^[a-z0-9]{1,12}$/.test(normalizedLanguage) ? normalizedLanguage : 'txt');
  const downloadName = safeFilename(filename || '') || `snippet-${index}.${extension}`;
  const { resolvedTheme } = useTheme();
  // Dark is the default until the resolved theme is known.
  const codeTheme = resolvedTheme === 'light' ? oneLight : oneDark;

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <figure className="my-4 block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-code-foreground/10 bg-code text-code-foreground shadow-sm">
      <figcaption className="flex min-h-10 items-center justify-between gap-3 border-b border-code-foreground/10 bg-code-header px-2.5 py-1.5 sm:px-3">
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs">
          <span className="truncate text-code-foreground" title={downloadName}>
            {downloadName}
          </span>
          <span className="shrink-0 rounded-md border border-code-foreground/10 px-1.5 py-0.5 text-[0.6875rem] text-code-foreground/75">
            {normalizedLanguage}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyButton
            text={code}
            label="Code"
            className="text-code-foreground hover:bg-code-foreground/10 hover:text-code-foreground"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={`Download ${downloadName}`}
            aria-label={`Download ${downloadName}`}
            onClick={downloadCode}
            className="h-8 px-2 text-code-foreground transition-[translate,scale,background-color,color] duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:bg-code-foreground/10 hover:text-code-foreground active:scale-[0.95] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100">
            <DownloadIcon className="size-3.5" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </figcaption>
      <div className="block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [contain:inline-size] [scrollbar-gutter:stable]">
        <SyntaxHighlighter
          wrapLongLines={false}
          PreTag="div"
          CodeTag="code"
          customStyle={{
            background: 'transparent',
            margin: 0,
            minWidth: 'max-content',
            padding: '1rem',
          }}
          codeTagProps={{ className: 'font-mono text-[0.8125rem] leading-6' }}
          language={normalizedLanguage}
          style={codeTheme}>
          {code}
        </SyntaxHighlighter>
      </div>
    </figure>
  );
};

export default CodeBlock;
