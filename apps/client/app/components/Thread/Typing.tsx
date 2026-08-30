const Typing = () => (
  <div className="max-w-[60px]">
    <div className="flex items-center justify-center gap-1 h-6">
      <div className="h-1 w-1 animate-typing rounded-full bg-muted-foreground"></div>
      <div className="h-1 w-1 animate-typing rounded-full bg-muted-foreground [animation-delay:150ms]"></div>
      <div className="h-1 w-1 animate-typing rounded-full bg-muted-foreground [animation-delay:300ms]"></div>
    </div>
  </div>
);

export default Typing;
