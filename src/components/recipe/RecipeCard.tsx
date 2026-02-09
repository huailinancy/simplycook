import { Clock, Users, Flame, Plus, Check, Bookmark, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Recipe } from '@/types/recipe';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedRecipesContext } from '@/contexts/SavedRecipesContext';
import { useLanguage, translateTag } from '@/contexts/LanguageContext';

interface RecipeCardProps {
  recipe: Recipe;
  onAddToMealPlan?: (recipe: Recipe) => void;
  isInMealPlan?: boolean;
  className?: string;
  saveCount?: number;
}

export function RecipeCard({ recipe, onAddToMealPlan, isInMealPlan, className, saveCount }: RecipeCardProps) {
  const calories = Math.round(recipe.calories / recipe.yield);
  const prepTime = recipe.totalTime || 30;
  const { user } = useAuth();
  const { isRecipeSaved, toggleSave } = useSavedRecipesContext();
  const { language } = useLanguage();

  const recipeId = parseInt(recipe.uri);
  const isSaved = isRecipeSaved(recipeId);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    await toggleSave(recipeId);
  };

  return (
    <Link to={`/recipe/${recipe.uri}`}>
    <article className={cn("recipe-card group cursor-pointer", className)}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={recipe.image}
          alt={recipe.label}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Time badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm gap-1.5">
            <Clock className="h-3 w-3" />
            {prepTime} min
          </Badge>
        </div>

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

      <div className="p-4">
        <h3 className="font-display text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors capitalize">
          {recipe.label}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          by {recipe.source}
        </p>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-spice" />
            <span>{calories} {language === 'zh' ? '卡' : 'cal'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-herb" />
            <span>{recipe.yield} {language === 'zh' ? '份' : 'servings'}</span>
          </div>
        </div>

        {/* Diet labels */}
        {recipe.dietLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {recipe.dietLabels.slice(0, 2).map((label) => (
              <Badge key={label} variant="outline" className="text-xs bg-herb-light text-herb border-herb/30">
                {translateTag(label, language)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
    </Link>
  );
}
