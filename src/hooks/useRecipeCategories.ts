import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface RecipeCategory {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export function useRecipeCategories() {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipe_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setCategories(data as RecipeCategory[]);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchCategories();
  }, [user, fetchCategories]);

  const addCategory = useCallback(async (name: string) => {
    if (!user) return null;
    try {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from('recipe_categories')
        .insert({ user_id: user.id, name, sort_order: maxOrder })
        .select()
        .single();
      if (error) throw error;
      setCategories(prev => [...prev, data as RecipeCategory]);
      return data as RecipeCategory;
    } catch (err) {
      console.error('Error adding category:', err);
      toast({ title: 'Error', description: 'Failed to create category', variant: 'destructive' });
      return null;
    }
  }, [user, categories, toast]);

  const renameCategory = useCallback(async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('recipe_categories')
        .update({ name })
        .eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    } catch (err) {
      console.error('Error renaming category:', err);
      toast({ title: 'Error', description: 'Failed to rename category', variant: 'destructive' });
    }
  }, [toast]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      // First unassign all recipes from this category
      const { error: unassignError } = await supabase
        .from('recipes')
        .update({ category_id: null })
        .eq('category_id', id);
      if (unassignError) throw unassignError;

      const { error } = await supabase
        .from('recipe_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting category:', err);
      toast({ title: 'Error', description: 'Failed to delete category', variant: 'destructive' });
    }
  }, [toast]);

  const reorderCategories = useCallback(async (reordered: RecipeCategory[]) => {
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(updated);
    // Update in DB
    for (const cat of updated) {
      await supabase
        .from('recipe_categories')
        .update({ sort_order: cat.sort_order })
        .eq('id', cat.id);
    }
  }, []);

  const assignRecipesToCategory = useCallback(async (recipeIds: number[], categoryId: string | null) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .update({ category_id: categoryId })
        .in('id', recipeIds);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error assigning recipes:', err);
      toast({ title: 'Error', description: 'Failed to assign recipes', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  return {
    categories,
    isLoading,
    fetchCategories,
    addCategory,
    renameCategory,
    deleteCategory,
    reorderCategories,
    assignRecipesToCategory,
  };
}
