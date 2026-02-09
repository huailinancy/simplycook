import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FilterOptions {
  cuisines: string[];
  mealTypes: string[];
  isLoading: boolean;
}

export function useFilterOptions(): FilterOptions {
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [mealTypes, setMealTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        // Fetch all recipes to extract unique values
        const { data, error } = await supabase
          .from('recipes')
          .select('cuisine, meal_type')
          .or('user_id.is.null,is_published.eq.true');

        if (error) throw error;

        // Extract unique cuisines
        const uniqueCuisines = new Set<string>();
        const uniqueMealTypes = new Set<string>();

        data?.forEach((recipe) => {
          if (recipe.cuisine) {
            uniqueCuisines.add(recipe.cuisine);
          }
          if (recipe.meal_type && Array.isArray(recipe.meal_type)) {
            recipe.meal_type.forEach((mt: string) => {
              if (mt) uniqueMealTypes.add(mt);
            });
          }
        });

        setCuisines(Array.from(uniqueCuisines).sort());
        setMealTypes(Array.from(uniqueMealTypes).sort());
      } catch (error) {
        console.error('Error fetching filter options:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFilterOptions();
  }, []);

  return { cuisines, mealTypes, isLoading };
}
