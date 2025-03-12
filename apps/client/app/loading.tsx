import clsx from 'clsx';

interface LoadingProps {
  className?: React.HtmlHTMLAttributes<HTMLDivElement>['className'];
}

const Loading = ({ className }: LoadingProps) => (
  <div
    className={clsx('h-[calc(100svh)] w-full flex items-center justify-center', className)}
    aria-label="Loading. Please wait...">
    <div className="relative">
      <div className="h-24 w-24 rounded-full border-t-8 border-b-8 border-gray-200 dark:border-gray-900"></div>
      <div className="absolute top-0 left-0 h-24 w-24 rounded-full border-t-8 border-b-8 border-purple-500 animate-spin"></div>
    </div>
  </div>
);

export default Loading;
