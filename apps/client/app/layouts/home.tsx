import { useEffect } from 'react';
import { Outlet } from 'react-router';

import Nav from '@/components/Nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import ChatQueueProvider from '@/components/ChatQueueProvider';

// A file dropped outside an accepting target (sidebar, signed-out view, unsupported model)
// would otherwise make the browser navigate to it.
const useBlockFileDropNavigation = () => {
  useEffect(() => {
    const block = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);
};

const Home = () => {
  useBlockFileDropNavigation();
  return (
    <SidebarProvider>
      <ChatQueueProvider />
      <AppSidebar />
      <main
        data-drop-zone
        className="relative flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background pr-[env(safe-area-inset-right,0px)] pl-[env(safe-area-inset-left,0px)]">
        <Nav />
        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Home;
