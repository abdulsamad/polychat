'use client';

import { Provider } from 'jotai';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';

import Home from '@/components/Home';
import Sidebar from '@/components/Sidebar';
import Chats from '@/components/Chats';
import Nav from '@/components/Nav';

const Page = () => {
  return (
    <Provider>
      <main className="conic-gradient(at right center, rgb(199, 210, 254), rgb(71, 85, 105), rgb(199, 210, 254))">
        <Nav />
        <Sidebar />
        <div className="lg:container">
          <Chats />
          <div className="flex flex-col justify-end">
            <Home />
          </div>
        </div>
      </main>
    </Provider>
  );
};

export default withPageAuthRequired(Page);
