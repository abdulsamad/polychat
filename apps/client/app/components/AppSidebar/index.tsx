import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAtom } from 'jotai';
import {
  LogOutIcon,
  PlusIcon,
  UserRoundPenIcon,
  ArrowUpRightIcon,
  ChevronDown,
  SettingsIcon,
} from 'lucide-react';
import { useSetAtom } from 'jotai';
import { useClerk, useAuth, useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import { threadAtom, messagesAtom } from '@/store';
import { getName } from '@/utils';
import { setActiveAccount } from '@/utils/byok-vault';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import ThreadsList from './ThreadsList';
import UserSettingsDialog from './UserSettingsDialog';

const AppSidebar = () => {
  const [message, setMessages] = useAtom(messagesAtom);
  const setThread = useSetAtom(threadAtom);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);

  const navigate = useNavigate();
  const clerk = useClerk();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  const addNewChat = useCallback(() => {
    setOpenMobile(false);

    if (message.length === 0) {
      toast.info('You are already in a new chat. Start typing your message!', {
        dismissible: true,
        closeButton: true,
      });
      return;
    }

    navigate('/');
  }, [setThread, setMessages, navigate, setOpenMobile, message]);

  return (
    <aside>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="mt-5">
                <Button
                  variant="default"
                  className="w-full bg-primary text-primary-foreground shadow-md transition-[color,box-shadow] hover:bg-primary/90 hover:shadow-lg"
                  onClick={addNewChat}>
                  <PlusIcon className="mr-2" />
                  New Chat
                </Button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <div className="h-full w-full flex flex-col justify-between overflow-x-hidden overflow-y-auto box-border">
            <ThreadsList />
          </div>
        </SidebarContent>
        <SidebarFooter className="px-2 py-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group/sidebar-footer">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.imageUrl} alt={getName(user)} />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{getName(user)}</span>
                      <span className="truncate text-xs">
                        {user?.emailAddresses[0].emailAddress}
                      </span>
                    </div>
                    <ChevronDown className="ml-auto size-4 group-has-data-[state=open]:rotate-z-180 transition-transform duration-300" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side={isMobile ? 'bottom' : 'right'}
                  align="end"
                  sideOffset={4}>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
                        <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{getName(user)}</span>
                        <span className="truncate text-xs">
                          {user?.emailAddresses[0].emailAddress}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setIsUserSettingsOpen(true)}>
                      <SettingsIcon className="mr-2 size-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={clerk.redirectToUserProfile}>
                      <UserRoundPenIcon className="size-4 mr-2" />
                      My Profile
                      <ArrowUpRightIcon className="size-4 ml-auto mr-1" />
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveAccount(null);
                      void signOut({ redirectUrl: window.location.origin });
                    }}>
                    <LogOutIcon />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <UserSettingsDialog open={isUserSettingsOpen} onOpenChange={setIsUserSettingsOpen} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </aside>
  );
};

export default AppSidebar;
