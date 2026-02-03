import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { SearchFilters, Recipe } from '@/types/recipe';
import { useRecipeSearch } from '@/hooks/useRecipeSearch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function Recipes() {
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });
  const { recipes, isLoading, totalResults, hasMore, searchRecipes, loadMore } = useRecipeSearch();
  const { toast } = useToast();

  // Load initial recipes on mount
  useEffect(() => {
    searchRecipes({ query: '' });
  }, []);

  const handleSearch = () => {
    searchRecipes(filters);
  };

  const handleLoadMore = () => {
    loadMore(filters);
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
            Recipe Search
          </h1>
          <p className="text-muted-foreground">
            Find the perfect recipe for any occasion
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

        {/* Results */}
        <RecipeGrid 
          recipes={recipes} 
          isLoading={isLoading}
          onAddToMealPlan={handleAddToMealPlan}
        />

        {/* Load More */}
        {hasMore && !isLoading && (
          <div className="flex justify-center mt-8">
            <Button onClick={handleLoadMore} variant="outline" size="lg">
              Load More Recipes
            </Button>
          </div>
        )}

        {/* Results count */}
        {totalResults > 0 && (
          <p className="text-center text-muted-foreground mt-4">
            Showing {recipes.length} of {totalResults} recipes
          </p>
        )}
      </div>
    </Layout>
  );
}
