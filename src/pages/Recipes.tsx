import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { SearchFilters, Recipe } from '@/types/recipe';
import { useRecipeSearch, SortOption } from '@/hooks/useRecipeSearch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from 'lucide-react';

export default function Recipes() {
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });
  const { recipes, supabaseRecipes, isLoading, totalResults, hasMore, sortBy, searchRecipes, loadMore, changeSortBy, getSaveCount } = useRecipeSearch();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Load initial recipes on mount
  useEffect(() => {
    searchRecipes({ query: '' });
  }, []);

  // Auto-search when any filter changes
  const filtersKey = `${filters.cuisineType || ''}-${filters.mealType || ''}-${filters.time || ''}`;
  useEffect(() => {
    searchRecipes(filters);
  }, [filtersKey]);

  const handleSearch = () => {
    searchRecipes(filters);
  };

  const handleLoadMore = () => {
    loadMore(filters);
  };

  const handleSortChange = (value: SortOption) => {
    changeSortBy(filters, value);
  };

  const handleAddToMealPlan = (recipe: Recipe) => {
    toast({
      title: 'Added to meal plan',
      description: `${recipe.label} has been added to your meal plan.`,
    });
  };

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            {t('recipes.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('recipes.subtitle')}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <RecipeFilters
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={handleSearch}
          />
        </div>

        {/* Sort and Results info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="text-muted-foreground">
            {totalResults > 0 && (
              <span>{t('recipes.showing')} {recipes.length} {t('recipes.of')} {totalResults}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('recipes.sortBy')}:</span>
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('recipes.newest')}</SelectItem>
                <SelectItem value="popular">{t('recipes.popular')}</SelectItem>
                <SelectItem value="name">{t('recipes.nameAZ')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        <RecipeGridWithSaveCount
          recipes={recipes}
          isLoading={isLoading}
          onAddToMealPlan={handleAddToMealPlan}
          getSaveCount={getSaveCount}
        />

        {/* Load More */}
        {hasMore && !isLoading && (
          <div className="flex justify-center mt-8">
            <Button onClick={handleLoadMore} variant="outline" size="lg">
              {t('recipes.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

// Custom RecipeGrid that passes save counts
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Skeleton } from '@/components/ui/skeleton';

interface RecipeGridWithSaveCountProps {
  recipes: Recipe[];
  isLoading?: boolean;
  onAddToMealPlan?: (recipe: Recipe) => void;
  getSaveCount: (recipeUri: string) => number;
}

function RecipeGridWithSaveCount({ recipes, isLoading, onAddToMealPlan, getSaveCount }: RecipeGridWithSaveCountProps) {
  const { t } = useLanguage();

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
        <p className="text-muted-foreground text-lg">{t('recipes.noResults')}</p>
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
            saveCount={getSaveCount(recipe.uri)}
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
