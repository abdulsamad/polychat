import { SidebarTrigger } from '@/components/ui/sidebar';

import SettingsDropdown from './SettingsDropdown';

const Nav = () => (
  <nav className="relative flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/90 px-3 py-1 backdrop-blur-sm sm:px-4">
    <SidebarTrigger />
    <h1 className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-lg leading-6 font-semibold tracking-tight text-foreground lg:text-xl">
      <img src="/polychat-navbar.png" alt="" className="size-7" aria-hidden="true" />
      <span>
        <span className="font-mono text-primary">Poly</span>Chat
      </span>
    </h1>
    <div className="flex size-9 items-center justify-center">
      <SettingsDropdown />
    </div>
  </nav>
);

export default Nav;
