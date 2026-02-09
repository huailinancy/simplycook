import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedRecipesContext } from '@/contexts/SavedRecipesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, SupabaseRecipe, toAppRecipe } from '@/types/recipe';
import { Bookmark, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SavedRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { savedRecipes } = useSavedRecipesContext();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  useEffect(() => {
    const fetchSavedRecipeDetails = async () => {
      if (!user || savedRecipes.length === 0) {
        setRecipes([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const recipeIds = savedRecipes.map(sr => sr.recipe_id);
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .in('id', recipeIds);

        if (error) throw error;

        const supabaseRecipes = data as SupabaseRecipe[];
        const appRecipes = supabaseRecipes.map(r => toAppRecipe(r, language));

        // Sort by save order (most recently saved first)
        const orderedRecipes = recipeIds
          .map(id => appRecipes.find(r => r.uri === id.toString()))
          .filter((r): r is Recipe => r !== undefined);

        setRecipes(orderedRecipes);
      } catch (error) {
        console.error('Error fetching saved recipes:', error);
        toast({
          title: 'Error',
          description: 'Failed to load saved recipes',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedRecipeDetails();
  }, [user, savedRecipes, toast, language]);

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  // Show sign-in prompt for non-authenticated users
  if (!user) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="text-center py-16">
            <Bookmark className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('saved.signInTitle')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('saved.signInDesc')}
            </p>
            <Link to="/auth">
              <Button className="gap-2">
                <LogIn className="h-4 w-4" />
                {t('nav.signIn')}
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bookmark className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              {t('saved.title')}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {t('saved.subtitle')}
          </p>
        </div>

        {/* Results */}
        {!isLoading && recipes.length === 0 ? (
          <div className="text-center py-16">
            <Bookmark className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('saved.empty')}</h2>
            <p className="text-muted-foreground">
              {t('saved.emptyDesc')}
            </p>
          </div>
        ) : (
          <RecipeGrid recipes={recipes} isLoading={isLoading} />
        )}

        {/* Count */}
        {recipes.length > 0 && (
          <p className="text-center text-muted-foreground mt-8">
            {recipes.length} saved {recipes.length === 1 ? 'recipe' : 'recipes'}
          </p>
        )}
      </div>
    </Layout>
  );
}
