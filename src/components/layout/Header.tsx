import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChefHat, Search, Calendar, ShoppingCart, UtensilsCrossed, LogOut, Bookmark, Import, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, userProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();

  // Get user initials for avatar
  const getUserInitials = () => {
    if (userProfile?.display_name) {
      return userProfile.display_name.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Handle click on auth-required nav items
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
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group -ml-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <ChefHat className="h-5 w-5" />
          </div>
          <span className="font-display text-sm font-semibold text-foreground">
            SimplyCook
          </span>
        </Link>

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

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2">
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

          <Link to="/recipes">
            <Button variant="outline" size="icon" className="md:hidden">
              <Search className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/recipes">
            <Button className="hidden sm:flex gap-2 btn-primary-gradient border-0">
              <Search className="h-4 w-4" />
              {t('nav.searchRecipes')}
            </Button>
          </Link>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary/50 transition-colors">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
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
            <Link to="/auth">
              <Button variant="outline">
                {t('nav.signIn')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
