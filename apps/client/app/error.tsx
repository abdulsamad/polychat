import { isRouteErrorResponse } from 'react-router';

import type { Route } from './+types/root';

const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="w-full px-16 md:px-0 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-4 py-8 shadow-2xl md:px-8 lg:px-24">
          <p className="text-6xl font-bold tracking-wider text-muted-foreground md:text-7xl lg:text-9xl">
            <img src="/feeling_blue.svg" alt="Something went wrong" width={400} height={400} />
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-wider text-muted-foreground md:text-3xl lg:text-5xl">
            Client Error
          </h1>
          <h1>{message}</h1>
          <p className="mt-8 max-w-[700px] border-y-2 py-2 text-center text-muted-foreground">
            Whoops, Something went wrong.
          </p>
          {/* <p>{details}</p> */}
          {stack && (
            <pre className="w-full p-4 overflow-x-auto">
              <code>{stack}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
