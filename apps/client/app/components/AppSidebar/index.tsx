import { useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { useAtom } from 'jotai';
import {
  LogOutIcon,
  PlusIcon,
  ChevronsUpDownIcon,
  LanguagesIcon,
  SunMoonIcon,
  UserRoundPenIcon,
  CheckIcon,
  ArrowUpRightIcon,
} from 'lucide-react';
import { useSetAtom } from 'jotai';
import { useClerk, useAuth, useUser } from '@clerk/react-router';
import clsx from 'clsx';
import { useTheme } from 'next-themes';

import { languages } from 'utils';

import { threadAtom, currentThreadIdAtom, configAtom } from '@/store';
import { getName } from '@/utils';
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

const AppSidebar = () => {
  const [config, setConfig] = useAtom(configAtom);
  const setCurrentThreadId = useSetAtom(currentThreadIdAtom);
  const setThread = useSetAtom(threadAtom);

  const navigate = useNavigate();
  const clerk = useClerk();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();

  const { language } = config;

  const addNewChat = useCallback(() => {
    setOpenMobile(false);

    setThread([] as any, true as any);
    setCurrentThreadId(crypto.randomUUID());

    navigate('/');
  }, [setThread, setCurrentThreadId, setOpen]);

  const updateSetting = useCallback(
    (name: string, value: string) => {
      setConfig({ ...config, [name]: value });
    },
    [config, setConfig]
  );

  return (
    <aside>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="mt-5">
                <Button
                  variant="default"
                  className="w-full text-white bg-gradient-to-r from-purple-700 via-purple-600 to-purple-500 hover:from-purple-600 hover:via-purple-500 hover:to-purple-400 transition-all duration-300 shadow-lg hover:shadow-purple-500/25"
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
            <Suspense fallback={<div className="text-center py-2">Loading...</div>}>
              <ThreadsList />
            </Suspense>
          </div>
        </SidebarContent>
        <SidebarFooter className="px-2 py-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
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
                    <ChevronsUpDownIcon className="ml-auto size-4" />
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
                      onClick={clerk.redirectToUserProfile}>
                      <UserRoundPenIcon className="size-4 mr-2" />
                      My Profile
                      <ArrowUpRightIcon className="size-4 ml-auto mr-1" />
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="w-full flex items-center p-2 data-[state=open]:bg-accent">
                          <LanguagesIcon className="size-4 mr-2 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm ml-2">Language</span>
                          <ChevronsUpDownIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="top"
                          align="end"
                          className="w-[160px] translate-x-16">
                          {languages.map(({ code, text }) => (
                            <DropdownMenuItem
                              key={code}
                              className={code === language ? 'font-semibold' : ''}
                              onClick={() => updateSetting('language', code)}>
                              {text}
                              <CheckIcon
                                className={clsx(
                                  'ml-auto h-4 w-4',
                                  code === language
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'opacity-0'
                                )}
                              />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="w-full flex items-center p-2 data-[state=open]:bg-accent">
                          <SunMoonIcon className="size-4 mr-2 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm ml-2">Theme</span>
                          <ChevronsUpDownIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="top"
                          align="end"
                          className="w-[160px] translate-x-16">
                          {['light', 'dark', 'system'].map((themeOption) => (
                            <DropdownMenuItem
                              key={themeOption}
                              className={clsx(theme === themeOption && 'font-semibold')}
                              onClick={() => setTheme(themeOption)}>
                              {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                              <CheckIcon
                                className={clsx(
                                  'ml-auto h-4 w-4',
                                  theme === themeOption
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'opacity-0'
                                )}
                              />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ redirectUrl: window.location.origin })}>
                    <LogOutIcon />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </aside>
  );
};

export default AppSidebar;
