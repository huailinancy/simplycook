import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, SearchFilters, SupabaseRecipe, toAppRecipe } from '@/types/recipe';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export type SortOption = 'newest' | 'popular' | 'name';

interface UseRecipeSearchOptions {
  sortBy?: SortOption;
}

export function useRecipeSearch(options: UseRecipeSearchOptions = {}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [supabaseRecipes, setSupabaseRecipes] = useState<SupabaseRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>(options.sortBy || 'newest');
  const { toast } = useToast();
  const { language } = useLanguage();

  const searchRecipes = useCallback(async (filters: SearchFilters, offset = 0, sort: SortOption = sortBy) => {
    setIsLoading(true);

    try {
      // Build Supabase query
      let query = supabase
        .from('recipes')
        .select('*', { count: 'exact' });

      // Only show public recipes: system recipes (user_id is null) OR published user recipes
      query = query.or('user_id.is.null,is_published.eq.true');

      // Search by name or description
      if (filters.query) {
        query = query.or(`name.ilike.%${filters.query}%,description.ilike.%${filters.query}%,english_name.ilike.%${filters.query}%`);
      }

      // Filter by cuisine
      if (filters.cuisineType) {
        query = query.ilike('cuisine', `%${filters.cuisineType}%`);
      }

      // Filter by meal type
      if (filters.mealType) {
        query = query.contains('meal_type', [filters.mealType.toLowerCase()]);
      }

      // Apply sorting
      switch (sort) {
        case 'popular':
          query = query.order('save_count', { ascending: false, nullsFirst: false });
          break;
        case 'name':
          query = query.order('name', { ascending: true });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Pagination
      const pageSize = 12;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      let fetchedRecipes = data as SupabaseRecipe[];

      // Apply client-side time filtering for accuracy
      if (filters.time) {
        fetchedRecipes = fetchedRecipes.filter(recipe => {
          const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
          switch (filters.time) {
            case '0-15':
              return totalTime <= 15;
            case '15-30':
              return totalTime > 15 && totalTime <= 30;
            case '30-60':
              return totalTime > 30 && totalTime <= 60;
            case '60+':
              return totalTime > 60;
            default:
              return true;
          }
        });
      }

      const appRecipes = fetchedRecipes.map(r => toAppRecipe(r, language));

      if (offset === 0) {
        setRecipes(appRecipes);
        setSupabaseRecipes(fetchedRecipes);
      } else {
        setRecipes(prev => [...prev, ...appRecipes]);
        setSupabaseRecipes(prev => [...prev, ...fetchedRecipes]);
      }

      // Use filtered count if time filter is applied, otherwise use server count
      setTotalResults(filters.time ? fetchedRecipes.length : (count || 0));
      setCurrentOffset(offset);
      setSortBy(sort);

      toast({
        title: `Found ${count || 0} recipes`,
        description: filters.query ? `Searching for "${filters.query}"` : 'Showing all recipes',
      });

    } catch (error) {
      console.error('Error searching recipes:', error);
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Failed to search recipes',
        variant: 'destructive',
      });
      setRecipes([]);
      setSupabaseRecipes([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, sortBy, language]);

  const loadMore = useCallback((filters: SearchFilters) => {
    searchRecipes(filters, currentOffset + 12, sortBy);
  }, [searchRecipes, currentOffset, sortBy]);

  const changeSortBy = useCallback((filters: SearchFilters, newSort: SortOption) => {
    searchRecipes(filters, 0, newSort);
  }, [searchRecipes]);

  const hasMore = currentOffset + 12 < totalResults;

  // Get save count for a recipe
  const getSaveCount = useCallback((recipeUri: string) => {
    const recipe = supabaseRecipes.find(r => r.id.toString() === recipeUri);
    return recipe?.save_count || 0;
  }, [supabaseRecipes]);

  return {
    recipes,
    supabaseRecipes,
    isLoading,
    totalResults,
    hasMore,
    sortBy,
    searchRecipes,
    loadMore,
    changeSortBy,
    getSaveCount,
  };
}
