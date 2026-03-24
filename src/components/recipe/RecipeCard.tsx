import { useState } from 'react';
import { Clock, Users, Flame, Plus, Check, Bookmark, Heart, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Recipe } from '@/types/recipe';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedRecipesContext } from '@/contexts/SavedRecipesContext';
import { useLanguage, translateTag } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RecipeCardProps {
  recipe: Recipe;
  onAddToMealPlan?: (recipe: Recipe) => void;
  isInMealPlan?: boolean;
  className?: string;
  saveCount?: number;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (recipeId: string) => void;
  showQuickLog?: boolean;
}

export function RecipeCard({ recipe, onAddToMealPlan, isInMealPlan, className, saveCount, selectable, isSelected, onSelect, showQuickLog }: RecipeCardProps) {
  const calories = Math.round(recipe.calories / recipe.yield);
  const prepTime = recipe.totalTime || 30;
  const { user } = useAuth();
  const { isRecipeSaved, toggleSave } = useSavedRecipesContext();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [logOpen, setLogOpen] = useState(false);

  const recipeId = parseInt(recipe.uri);
  const isSaved = isRecipeSaved(recipeId);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    await toggleSave(recipeId);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectable && onSelect) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(recipe.uri);
    }
  };

  const Wrapper = selectable ? 'div' : Link;
  const wrapperProps = selectable ? { onClick: handleCardClick } : { to: `/recipe/${recipe.uri}` };

  return (
    <Wrapper {...wrapperProps as any}>
    <article className={cn(
      "recipe-card group cursor-pointer relative",
      selectable && isSelected && "ring-2 ring-primary rounded-xl",
      className
    )}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={recipe.image}
          alt={recipe.label}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Selection indicator */}
        {selectable && (
          <div className={cn(
            "absolute top-3 left-3 z-10 transition-all",
          )}>
            <CheckCircle2 className={cn(
              "h-6 w-6 drop-shadow-md",
              isSelected ? "text-primary fill-primary-foreground" : "text-white/60"
            )} />
          </div>
        )}
        {/* Save/Bookmark button - only visible for logged in users */}
        {user && (
          <Button
            size="icon"
            variant={isSaved ? "secondary" : "default"}
            className={cn(
              "absolute top-3 right-3 h-8 w-8 transition-all",
              isSaved
                ? "opacity-100 bg-primary text-primary-foreground"
                : "opacity-0 group-hover:opacity-100"
            )}
            onClick={handleSaveClick}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </Button>
        )}

        {/* Add to meal plan button */}
        {onAddToMealPlan && (
          <Button
            size="icon"
            variant={isInMealPlan ? "secondary" : "default"}
            className={cn(
              "absolute top-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-all",
              user ? "right-14" : "right-3",
              isInMealPlan && "opacity-100 bg-herb text-herb-foreground"
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddToMealPlan(recipe);
            }}
          >
            {isInMealPlan ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        )}

        {/* Cuisine type */}
        {recipe.cuisineType?.[0] && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-sm">
              {translateTag(recipe.cuisineType[0], language)}
            </Badge>
          </div>
        )}

        {/* Save count badge */}
        {saveCount !== undefined && saveCount > 0 && (
          <div className="absolute bottom-3 right-3">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm gap-1">
              <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
              {saveCount}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-3 md:p-4">
        <h3 className="font-display text-sm md:text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors capitalize">
          {recipe.label}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 mb-2 md:mb-3">
          by {recipe.source}
        </p>

        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            <span>{prepTime} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="h-3 w-3 md:h-4 md:w-4 text-spice" />
            <span>{calories} {language === 'zh' ? '卡' : 'cal'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 md:h-4 md:w-4 text-herb" />
            <span>{recipe.yield} {language === 'zh' ? '份' : 'servings'}</span>
          </div>
        </div>

        {/* Diet labels */}
        {recipe.dietLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 md:gap-1.5 mt-2 md:mt-3">
            {recipe.dietLabels.slice(0, 2).map((label) => (
              <Badge key={label} variant="outline" className="text-[10px] md:text-xs bg-herb-light text-herb border-herb/30">
                {translateTag(label, language)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
    </Wrapper>
  );
}
