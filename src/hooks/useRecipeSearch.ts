import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, SearchFilters } from '@/types/recipe';
import { useToast } from '@/hooks/use-toast';

interface SearchResult {
  recipes: Recipe[];
  totalResults: number;
  offset: number;
  number: number;
}

export function useRecipeSearch() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const { toast } = useToast();

  const searchRecipes = useCallback(async (filters: SearchFilters, offset = 0) => {
    setIsLoading(true);
    
    try {
      // Build query params
      const params = new URLSearchParams();
      
      if (filters.query) {
        params.set('query', filters.query);
      }
      if (filters.cuisineType) {
        params.set('cuisine', filters.cuisineType.toLowerCase());
      }
      if (filters.mealType) {
        // Spoonacular uses 'type' for dish types like main course, dessert, etc.
        params.set('type', filters.mealType.toLowerCase());
      }
      if (filters.diet) {
        params.set('diet', filters.diet.toLowerCase());
      }
      if (filters.time) {
        // Parse time range like "0-15", "15-30", etc.
        const maxTime = filters.time.includes('+') 
          ? undefined 
          : parseInt(filters.time.split('-')[1]);
        if (maxTime) {
          params.set('maxReadyTime', maxTime.toString());
        }
      }
      
      params.set('number', '12');
      params.set('offset', offset.toString());

      const { data, error } = await supabase.functions.invoke<SearchResult>('search-recipes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Pass params via query string in the body since invoke doesn't support query params directly
      });

      // For GET requests with query params, we need to construct the URL manually
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-recipes?${params.toString()}`;
      
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search recipes');
      }

      const result: SearchResult = await response.json();
      
      if (offset === 0) {
        setRecipes(result.recipes);
      } else {
        setRecipes(prev => [...prev, ...result.recipes]);
      }
      
      setTotalResults(result.totalResults);
      setCurrentOffset(offset);
      
      toast({
        title: `Found ${result.totalResults} recipes`,
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
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadMore = useCallback((filters: SearchFilters) => {
    searchRecipes(filters, currentOffset + 12);
  }, [searchRecipes, currentOffset]);

  const hasMore = currentOffset + 12 < totalResults;

  return {
    recipes,
    isLoading,
    totalResults,
    hasMore,
    searchRecipes,
    loadMore,
  };
}
