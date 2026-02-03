import { Recipe } from '@/types/recipe';
import { RecipeCard } from './RecipeCard';
import { Skeleton } from '@/components/ui/skeleton';

interface RecipeGridProps {
  recipes: Recipe[];
  isLoading?: boolean;
  onAddToMealPlan?: (recipe: Recipe) => void;
  mealPlanRecipeIds?: string[];
}

export function RecipeGrid({ recipes, isLoading, onAddToMealPlan, mealPlanRecipeIds = [] }: RecipeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <RecipeCardSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">No recipes found. Try adjusting your search.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {recipes.map((recipe, i) => (
        <div key={recipe.uri} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          <RecipeCard
            recipe={recipe}
            onAddToMealPlan={onAddToMealPlan}
            isInMealPlan={mealPlanRecipeIds.includes(recipe.uri)}
          />
        </div>
      ))}
    </div>
  );
}

function RecipeCardSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-soft">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
