import { type HTMLAttributes } from 'react';
import { toast } from 'sonner';
import { CopyIcon, DownloadIcon, TerminalIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { PrismAsync as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  synthwave84 as darkTheme,
  oneLight as lightTheme,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { clsx } from 'clsx';
import { useTheme } from 'next-themes';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHeader,
  TableHead,
  TableFooter,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CopyToClipboard from '@/components/Message/CopyToClipboard';

import '@fontsource/fira-code';

interface IText {
  isUser: boolean;
  messageClassNames: HTMLAttributes<HTMLSpanElement>['className'];
  message?: string;
}

const Text = ({ isUser, messageClassNames, message }: IText) => {
  const { resolvedTheme } = useTheme();

  const downloadCode = (code: string, language: string) => {
    const extension = language.toLowerCase().replace(/[^a-z0-9]/g, '') || 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `code-snippet.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      className={clsx(
        "message group/message relative inline-block py-1.5 px-3 rounded-xl before:content-[''] before:block before:h-0 before:w-0 before:border-y-8 before:border-y-transparent before:border-l-[14px] before:border-l-primary before:absolute before:top-1/2 before:-translate-y-1/2] [&_p:has(code)]:leading-8 [&_div:has(code)]:leading-8 [&_span:has(code)]:leading-8 max-w-[min(70%,_500px)]",
        messageClassNames
      )}>
      {isUser ? (
        message
      ) : (
        <ErrorBoundary fallbackRender={fallbackRender}>
          <Markdown
            remarkPlugins={[[remarkGfm]]}
            components={{
              code(props) {
                const { children, className, node, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                const code = String(children).replace(/\n$/, '');

                return (
                  <>
                    {match ? (
                      <div className="leading-relaxed ligatures [font-family:_Fira_Code]">
                        <div className="flex justify-end items-center">
                          <CopyToClipboard
                            text={code}
                            onCopy={() => toast.success('Copied!')}>
                            <Button
                              title="Copy"
                              size="default"
                              className="h-6 w-20 font-sans ml-auto mr-[11px] rounded-t-lg rounded-b-none transition-all duration-300 opacity-0 translate-y-1 group-hover/message:opacity-100 group-hover/message:translate-y-0 group-focus-within/message:opacity-100 group-focus-within/message:translate-y-0">
                              <span>Copy</span> <CopyIcon className="h-4 w-4" />
                            </Button>
                          </CopyToClipboard>
                          <Button
                            type="button"
                            title="Download code"
                            aria-label="Download code"
                            size="icon"
                            variant="ghost"
                            onClick={() => downloadCode(code, match[1])}
                            className="h-6 w-8 rounded-t-lg rounded-b-none mr-[11px] transition-all duration-300 opacity-0 translate-y-1 group-hover/message:opacity-100 group-hover/message:translate-y-0 group-focus-within/message:opacity-100 group-focus-within/message:translate-y-0">
                            <DownloadIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="font-bold">
                          <SyntaxHighlighter
                            {...rest}
                            wrapLongLines
                            PreTag="div"
                            customStyle={{ margin: 0 }}
                            language={match[1]}
                            ref={undefined}
                            style={resolvedTheme === 'dark' ? darkTheme : lightTheme}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    ) : (
                      <SyntaxHighlighter
                        {...rest}
                        wrapLongLines
                        PreTag="div"
                        customStyle={{ margin: 0 }}
                        language="bash"
                        ref={undefined}
                        style={resolvedTheme === 'dark' ? darkTheme : lightTheme}>
                        {String(children?.toString().trim()).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )}
                  </>
                );
              },
              p: ({ children }) => <p className="leading-6">{children}</p>,
              span: ({ children }) => <span>{children}</span>,
              div: ({ children }) => <div className="my-2">{children}</div>,
              table: ({ children }) => (
                <Table className="w-full border-collapse my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
                  {children}
                </Table>
              ),
              thead: ({ children }) => (
                <TableHeader className="bg-gradient-to-r from-purple-500 to-purple-900 text-slate-50 border-b border-gray-200 dark:border-gray-700">
                  {children}
                </TableHeader>
              ),
              tbody: ({ children }) => (
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800 bg-gradient-to-r from-slate-900 to-slate-700">
                  {children}
                </TableBody>
              ),
              tfoot: ({ children }) => (
                <TableFooter className="bg-gray-50/80 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700">
                  {children}
                </TableFooter>
              ),
              tr: ({ children }) => (
                <TableRow className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors duration-200">
                  {children}
                </TableRow>
              ),
              th: ({ children }) => (
                <TableHead className="py-3 px-4 text-left font-semibold text-blue-900 dark:text-blue-100">
                  {children}
                </TableHead>
              ),
              td: ({ children }) => (
                <TableCell className="py-2.5 px-4 text-gray-800 dark:text-gray-200">
                  {children}
                </TableCell>
              ),
              pre: ({ children }) => (
                <pre className="max-w-[calc(100vw-148px)] md:max-w-[calc(100vw-400px)] lg:max-w-[calc(100vw-450px)]">
                  {children}
                </pre>
              ),
            }}>
            {message || ''}
          </Markdown>
        </ErrorBoundary>
      )}
    </Card>
  );
};

const fallbackRender = ({ error }: FallbackProps) => (
  <Alert>
    <TerminalIcon className="h-4 w-4" />
    <AlertTitle>Error Rendering Message</AlertTitle>
    <AlertDescription>
      <p>Unable to display this message due to an error:</p>
      {/* <pre style={{ color: 'red' }}>{error.message}</pre> */}
      <p className="text-sm text-muted-foreground mt-2">
        This could be due to invalid markdown formatting or unsupported content in the response. You
        can still copy the raw message using the copy button.
      </p>
    </AlertDescription>
  </Alert>
);

export default Text;
