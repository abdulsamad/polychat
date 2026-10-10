import { Outlet } from 'react-router';

import Nav from '@/components/Nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import ChatQueueProvider from '@/components/ChatQueueProvider';

const Home = () => {
  return (
    <SidebarProvider>
      <ChatQueueProvider />
      <AppSidebar />
      <main className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background pr-[env(safe-area-inset-right,0px)] pl-[env(safe-area-inset-left,0px)]">
        <Nav />
        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Home;
