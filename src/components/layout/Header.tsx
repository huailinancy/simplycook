import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChefHat, Search, Calendar, ShoppingCart, UtensilsCrossed, LogOut, Bookmark, Import, Globe, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, userProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getUserInitials = () => {
    if (userProfile?.display_name) {
      return userProfile.display_name.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const handleAuthRequiredClick = (e: React.MouseEvent, path: string, labelKey: string) => {
    if (!user) {
      e.preventDefault();
      toast({
        title: t('common.signInRequired'),
        description: language === 'zh' ? '请登录以访问此功能' : `Please sign in to access your ${t(labelKey).toLowerCase()} recipes`,
      });
      navigate('/auth');
    }
  };

  const navItems = [
    { path: '/', labelKey: 'nav.home', icon: ChefHat, requiresAuth: false },
    { path: '/recipes', labelKey: 'nav.recipes', icon: UtensilsCrossed, requiresAuth: false },
    { path: '/meal-planner', labelKey: 'nav.mealPlanner', icon: Calendar, requiresAuth: false },
    { path: '/grocery-list', labelKey: 'nav.groceryList', icon: ShoppingCart, requiresAuth: false },
    { path: '/saved', labelKey: 'nav.saved', icon: Bookmark, requiresAuth: true },
    { path: '/my-recipes', labelKey: 'nav.imported', icon: Import, requiresAuth: true },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-14 md:h-16 items-center justify-between">
        {/* Mobile menu + Logo */}
        <div className="flex items-center gap-1">
          {/* Mobile hamburger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <ChefHat className="h-4 w-4" />
                  </div>
                  SimplyCook
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col py-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <SheetClose asChild key={item.path}>
                      <Link
                        to={item.path}
                        onClick={(e) => {
                          if (item.requiresAuth) handleAuthRequiredClick(e, item.path, item.labelKey);
                        }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted",
                          isActive && "bg-primary/10 text-primary border-r-2 border-primary"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {t(item.labelKey)}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
              {/* Mobile user section */}
              <div className="border-t p-4 mt-auto">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 border border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {userProfile?.display_name && (
                          <p className="text-sm font-medium truncate">{userProfile.display_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                      onClick={() => { signOut(); setMobileMenuOpen(false); }}
                    >
                      <LogOut className="h-4 w-4" />
                      {t('nav.signOut')}
                    </Button>
                  </div>
                ) : (
                  <SheetClose asChild>
                    <Link to="/auth">
                      <Button className="w-full">{t('nav.signIn')}</Button>
                    </Link>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <ChefHat className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground">
              SimplyCook
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => item.requiresAuth && handleAuthRequiredClick(e, item.path, item.labelKey)}
              >
                <Button
                  variant="ghost"
                  className={cn(
                    "gap-2 transition-colors",
                    isActive && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2 h-8 md:h-9">
                <Globe className="h-4 w-4" />
                <span className="text-xs">{language === 'zh' ? '中文' : 'EN'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setLanguage('en')}
                className={cn("cursor-pointer", language === 'en' && "bg-primary/10")}
              >
                English
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLanguage('zh')}
                className={cn("cursor-pointer", language === 'zh' && "bg-primary/10")}
              >
                中文
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link to="/recipes" className="hidden sm:block">
            <Button className="gap-2 btn-primary-gradient border-0 h-8 md:h-9 text-sm">
              <Search className="h-4 w-4" />
              <span className="hidden lg:inline">{t('nav.searchRecipes')}</span>
            </Button>
          </Link>

          {/* Desktop user menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 md:h-10 md:w-10 rounded-full p-0 hidden md:flex">
                  <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-primary/20 hover:border-primary/50 transition-colors">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs md:text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {userProfile?.display_name && (
                      <p className="font-medium">{userProfile.display_name}</p>
                    )}
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/saved" className="cursor-pointer">
                    <Bookmark className="h-4 w-4 mr-2" />
                    {t('nav.saved')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/my-recipes" className="cursor-pointer">
                    <Import className="h-4 w-4 mr-2" />
                    {t('nav.imported')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('nav.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" className="hidden md:block">
              <Button variant="outline" size="sm">
                {t('nav.signIn')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
