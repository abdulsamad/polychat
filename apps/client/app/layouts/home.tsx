import { Outlet } from 'react-router';
import { RedirectToSignIn, useAuth } from '@clerk/react-router';

import Nav from '@/components/Nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import ChatQueueProvider from '@/components/ChatQueueProvider';
import Loading from '@/loading';

const Home = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <RedirectToSignIn />;

  return (
    <SidebarProvider>
      <ChatQueueProvider />
      <AppSidebar />
      <main className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <Nav />
        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Home;
