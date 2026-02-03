import { Clock, Users, Flame, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Recipe } from '@/types/recipe';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: Recipe;
  onAddToMealPlan?: (recipe: Recipe) => void;
  isInMealPlan?: boolean;
  className?: string;
}

export function RecipeCard({ recipe, onAddToMealPlan, isInMealPlan, className }: RecipeCardProps) {
  const calories = Math.round(recipe.calories / recipe.yield);
  const prepTime = recipe.totalTime || 30;

  return (
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

        {/* Add to meal plan button */}
        {onAddToMealPlan && (
          <Button
            size="icon"
            variant={isInMealPlan ? "secondary" : "default"}
            className={cn(
              "absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-all",
              isInMealPlan && "opacity-100 bg-herb text-herb-foreground"
            )}
            onClick={(e) => {
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
              {recipe.cuisineType[0]}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-display text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {recipe.label}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          by {recipe.source}
        </p>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-spice" />
            <span>{calories} cal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-herb" />
            <span>{recipe.yield} servings</span>
          </div>
        </div>

        {/* Diet labels */}
        {recipe.dietLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {recipe.dietLabels.slice(0, 2).map((label) => (
              <Badge key={label} variant="outline" className="text-xs bg-herb-light text-herb border-herb/30">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
