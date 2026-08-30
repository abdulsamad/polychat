import { SidebarTrigger } from '@/components/ui/sidebar';

import SettingsDropdown from './SettingsDropdown';

const Nav = () => (
  <nav className="relative flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/90 px-3 py-1 backdrop-blur-sm sm:px-4">
    <SidebarTrigger />
    <h1 className="text-lg leading-6 font-semibold tracking-tight text-foreground lg:text-xl">
      <span className="font-mono text-primary">Poly</span>Chat
    </h1>
    <SettingsDropdown />
  </nav>
);

export default Nav;
