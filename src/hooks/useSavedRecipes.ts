import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SavedRecipe } from '@/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useSavedRecipes() {
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSavedRecipes = useCallback(async () => {
    if (!user) {
      setSavedRecipes([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedRecipes(data as SavedRecipe[]);
    } catch (error) {
      console.error('Error fetching saved recipes:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch saved recipes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const saveRecipe = useCallback(async (recipeId: number) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save recipes',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('saved_recipes')
        .insert({
          user_id: user.id,
          recipe_id: recipeId,
        });

      if (error) throw error;

      // Refresh the saved recipes list
      await fetchSavedRecipes();

      toast({
        title: 'Recipe saved',
        description: 'Added to your saved recipes',
      });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({
          title: 'Already saved',
          description: 'This recipe is already in your saved recipes',
        });
      } else {
        console.error('Error saving recipe:', error);
        toast({
          title: 'Error',
          description: 'Failed to save recipe',
          variant: 'destructive',
        });
      }
      return false;
    }
  }, [user, toast, fetchSavedRecipes]);

  const unsaveRecipe = useCallback(async (recipeId: number) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_recipes')
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId);

      if (error) throw error;

      // Refresh the saved recipes list
      await fetchSavedRecipes();

      toast({
        title: 'Recipe removed',
        description: 'Removed from your saved recipes',
      });
      return true;
    } catch (error) {
      console.error('Error unsaving recipe:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove recipe',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, fetchSavedRecipes]);

  const toggleSave = useCallback(async (recipeId: number) => {
    const isSaved = savedRecipes.some(sr => sr.recipe_id === recipeId);
    if (isSaved) {
      return unsaveRecipe(recipeId);
    } else {
      return saveRecipe(recipeId);
    }
  }, [savedRecipes, saveRecipe, unsaveRecipe]);

  const isRecipeSaved = useCallback((recipeId: number) => {
    return savedRecipes.some(sr => sr.recipe_id === recipeId);
  }, [savedRecipes]);

  return {
    savedRecipes,
    isLoading,
    fetchSavedRecipes,
    saveRecipe,
    unsaveRecipe,
    toggleSave,
    isRecipeSaved,
  };
}
