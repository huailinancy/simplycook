import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useAuth } from '@/contexts/AuthContext';
import { SavedRecipe } from '@/types/recipe';

interface SavedRecipesContextType {
  savedRecipes: SavedRecipe[];
  isLoading: boolean;
  toggleSave: (recipeId: number) => Promise<boolean>;
  isRecipeSaved: (recipeId: number) => boolean;
  refreshSavedRecipes: () => Promise<void>;
}

const SavedRecipesContext = createContext<SavedRecipesContextType | undefined>(undefined);

export function SavedRecipesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    savedRecipes,
    isLoading,
    fetchSavedRecipes,
    toggleSave,
    isRecipeSaved,
  } = useSavedRecipes();

  useEffect(() => {
    if (user) {
      fetchSavedRecipes();
    }
  }, [user, fetchSavedRecipes]);

  return (
    <SavedRecipesContext.Provider value={{
      savedRecipes,
      isLoading,
      toggleSave,
      isRecipeSaved,
      refreshSavedRecipes: fetchSavedRecipes,
    }}>
      {children}
    </SavedRecipesContext.Provider>
  );
}

export function useSavedRecipesContext() {
  const context = useContext(SavedRecipesContext);
  if (context === undefined) {
    throw new Error('useSavedRecipesContext must be used within a SavedRecipesProvider');
  }
  return context;
}
