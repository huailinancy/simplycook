import { Link, useLocation } from 'react-router-dom';
import { ChefHat, Search, Calendar, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Home', icon: ChefHat },
  { path: '/recipes', label: 'Recipes', icon: UtensilsCrossed },
  { path: '/meal-planner', label: 'Meal Planner', icon: Calendar },
  { path: '/grocery-list', label: 'Grocery List', icon: ShoppingCart },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <ChefHat className="h-5 w-5" />
          </div>
          <span className="font-display text-base font-semibold text-foreground">
            SimplyCook
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    "gap-2 transition-colors",
                    isActive && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/recipes">
            <Button variant="outline" size="icon" className="md:hidden">
              <Search className="h-4 w-4" />
            </Button>
          </Link>
          <Button className="hidden sm:flex gap-2 btn-primary-gradient border-0">
            <Search className="h-4 w-4" />
            Search Recipes
          </Button>
        </div>
      </div>
    </header>
  );
}
