import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChefHat, UtensilsCrossed, Calendar, ShoppingCart, Bookmark, Import } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const handleAuthRequired = (e: React.MouseEvent, path: string) => {
    if (!user) {
      e.preventDefault();
      toast({
        title: t('common.signInRequired'),
        description: language === 'zh' ? '请登录以访问此功能' : 'Please sign in to access this feature',
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
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => item.requiresAuth && handleAuthRequired(e, item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors",
                isActive && "text-primary"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-[10px] font-medium leading-none">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
