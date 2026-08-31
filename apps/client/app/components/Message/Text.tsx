import { type HTMLAttributes } from 'react';
import { TerminalIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { clsx } from 'clsx';

import { Card } from '@/components/ui/card';
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
import CodeBlock from '@/components/Message/CodeBlock';

interface IText {
  isUser: boolean;
  messageClassNames: HTMLAttributes<HTMLSpanElement>['className'];
  message?: string;
}

interface MarkdownNode {
  children?: MarkdownNode[];
  data?: { meta?: unknown };
  lang?: string | null;
  meta?: string | null;
  position?: { start: { line: number }; end: { line: number } };
  type: string;
  value?: string;
}

const filenamePattern = /^(?:[\w@.-]+[\\/])*[\w@.-]+\.[a-z0-9]{1,12}$/i;

const remarkCodeFilenames = () => (tree: MarkdownNode) => {
  if (!tree.children) return;

  for (let index = 0; index < tree.children.length - 1; index += 1) {
    const paragraph = tree.children[index];
    const code = tree.children[index + 1];
    const child = paragraph.type === 'paragraph' ? paragraph.children?.[0] : undefined;
    const isStandaloneValue = paragraph.children?.length === 1 && child?.value;
    const filename = isStandaloneValue ? child.value!.trim() : '';

    if (
      code.type !== 'code' ||
      !['inlineCode', 'text'].includes(child?.type || '') ||
      !filenamePattern.test(filename)
    ) {
      continue;
    }

    code.meta = `${code.meta || ''} filename=${JSON.stringify(filename)}`.trim();
    tree.children.splice(index, 1);
    index -= 1;
  }
};

const getFilename = (meta?: string) => {
  if (!meta) return undefined;

  const namedMatch = /(?:filename|file|title)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(meta);
  if (namedMatch) return namedMatch[1] || namedMatch[2] || namedMatch[3];

  const bareValue = meta.trim();
  return filenamePattern.test(bareValue) ? bareValue : undefined;
};

const Text = ({ isUser, messageClassNames, message }: IText) => {
  let codeBlockIndex = 0;

  return (
    <Card
      className={clsx(
        'message min-w-0 max-w-full select-text rounded-2xl px-3 py-2.5 [overflow-wrap:anywhere] sm:px-4 sm:py-3',
        messageClassNames
      )}>
      {isUser ? (
        <p className="whitespace-pre-wrap text-[0.9375rem] leading-6 [overflow-wrap:anywhere]">
          {message}
        </p>
      ) : (
        <ErrorBoundary fallbackRender={fallbackRender}>
          <Markdown
            remarkPlugins={[remarkGfm, remarkCodeFilenames]}
            components={{
              code(props) {
                const { children, className, node, ...rest } = props;
                const match = /language-([^\s]+)/.exec(className || '');
                const code = String(children).replace(/\n$/, '');
                const meta = typeof node?.data?.meta === 'string' ? node.data.meta : undefined;
                const spansMultipleLines = node?.position?.start.line !== node?.position?.end.line;
                const isBlock = Boolean(match || meta || spansMultipleLines);

                if (isBlock) {
                  codeBlockIndex += 1;
                  return (
                    <CodeBlock
                      code={code}
                      filename={getFilename(meta)}
                      index={codeBlockIndex}
                      language={match?.[1] || 'text'}
                    />
                  );
                }

                return (
                  <code
                    {...rest}
                    className="rounded-md border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground [overflow-wrap:anywhere]">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => <>{children}</>,
              h1: ({ children }) => (
                <h1 className="mt-6 mb-3 text-xl font-semibold tracking-tight text-balance first:mt-0 sm:text-2xl">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-6 mb-3 text-lg font-semibold tracking-tight text-balance first:mt-0 sm:text-xl">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-5 mb-2 text-base font-semibold text-balance first:mt-0 sm:text-lg">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="my-3 text-[0.9375rem] leading-7 [text-wrap:pretty] first:mt-0 last:mb-0 sm:text-base">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-primary">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:font-medium marker:text-muted-foreground">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="my-4 border-l-2 border-primary/70 bg-muted/60 px-4 py-2 text-muted-foreground italic">
                  {children}
                </blockquote>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
                  {children}
                </a>
              ),
              hr: () => <hr className="my-6 border-border" />,
              table: ({ children }) => (
                <Table className="my-4 min-w-[32rem] border-collapse overflow-hidden rounded-lg border border-border bg-card">
                  {children}
                </Table>
              ),
              thead: ({ children }) => (
                <TableHeader className="border-b border-border bg-muted text-foreground">
                  {children}
                </TableHeader>
              ),
              tbody: ({ children }) => (
                <TableBody className="divide-y divide-border bg-card">{children}</TableBody>
              ),
              tfoot: ({ children }) => (
                <TableFooter className="border-t border-border bg-muted/70">{children}</TableFooter>
              ),
              tr: ({ children }) => (
                <TableRow className="transition-colors hover:bg-accent/50">{children}</TableRow>
              ),
              th: ({ children }) => (
                <TableHead className="px-4 py-3 text-left font-semibold text-foreground text-balance">
                  {children}
                </TableHead>
              ),
              td: ({ children }) => (
                <TableCell className="px-4 py-2.5 text-foreground">{children}</TableCell>
              ),
            }}>
            {message || ''}
          </Markdown>
        </ErrorBoundary>
      )}
    </Card>
  );
};

const fallbackRender = ({}: FallbackProps) => (
  <Alert role="alert">
    <TerminalIcon className="h-4 w-4" />
    <AlertTitle>Error Rendering Message</AlertTitle>
    <AlertDescription>
      <p>Unable to display this message due to an error:</p>
      <p className="text-sm text-muted-foreground mt-2">
        This could be due to invalid markdown formatting or unsupported content in the response. You
        can retry the request or refresh the chat.
      </p>
    </AlertDescription>
  </Alert>
);

export default Text;
