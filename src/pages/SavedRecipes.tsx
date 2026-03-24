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
import { Bookmark, LogIn, Globe, CheckSquare, X, Loader2 } from 'lucide-react';
import { QuickAddRecipeDialog } from '@/components/recipe/QuickAddRecipeDialog';
import { useToast } from '@/hooks/use-toast';

export default function SavedRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPublishing, setIsPublishing] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { savedRecipes } = useSavedRecipesContext();
  const { toast } = useToast();
  const { t, language } = useLanguage();

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

  useEffect(() => {
    fetchSavedRecipeDetails();
  }, [user, savedRecipes, toast, language]);

  const handleSelect = (recipeId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === recipes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recipes.map(r => r.uri)));
    }
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) return;

    setIsPublishing(true);
    try {
      const ids = Array.from(selectedIds).map(id => parseInt(id));

      // Fetch user display name for author field
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const authorName = profile?.display_name || user.email?.split('@')[0] || 'User';

      // Update each recipe to published with author name
      const promises = ids.map(id =>
        supabase
          .from('recipes')
          .update({ is_published: true, author: authorName })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        console.error('Some recipes failed to publish:', errors);
        toast({
          title: language === 'zh' ? '部分发布失败' : 'Partial failure',
          description: language === 'zh'
            ? `${ids.length - errors.length}/${ids.length} 个菜谱发布成功`
            : `${ids.length - errors.length}/${ids.length} recipes published`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: language === 'zh' ? '发布成功' : 'Published',
          description: language === 'zh'
            ? `已成功发布 ${ids.length} 个菜谱到社区`
            : `Successfully published ${ids.length} recipe${ids.length > 1 ? 's' : ''} to community`,
        });
      }

      handleCancelSelect();
      fetchSavedRecipeDetails();
    } catch (error) {
      console.error('Error publishing recipes:', error);
      toast({
        title: language === 'zh' ? '发布失败' : 'Error',
        description: language === 'zh' ? '发布菜谱时出错' : 'Failed to publish recipes',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

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
      <div className="container py-4 md:py-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <Bookmark className="h-5 w-5 md:h-8 md:w-8 text-primary" />
                <h1 className="font-display text-xl md:text-4xl font-bold">
                  {t('saved.title')}
                </h1>
              </div>
              <p className="text-xs md:text-base text-muted-foreground">
                {t('saved.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              {recipes.length > 0 && !selectMode && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setSelectMode(true)}
                >
                  <CheckSquare className="h-4 w-4" />
                  {language === 'zh' ? '选择' : 'Select'}
                </Button>
              )}
              <QuickAddRecipeDialog onRecipesAdded={fetchSavedRecipeDetails} />
            </div>
          </div>
        </div>

        {/* Selection action bar */}
        {selectMode && (
          <div className="mb-3 md:mb-4 flex flex-wrap items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 md:px-4 py-2 md:py-3 border border-border">
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="sm" className="h-7 md:h-8 text-xs md:text-sm" onClick={handleCancelSelect}>
                <X className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
                {language === 'zh' ? '取消' : 'Cancel'}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 md:h-8 text-xs md:text-sm" onClick={handleSelectAll}>
                {selectedIds.size === recipes.length
                  ? (language === 'zh' ? '取消全选' : 'Deselect All')
                  : (language === 'zh' ? '全选' : 'Select All')}
              </Button>
              <span className="text-xs md:text-sm text-muted-foreground">
                {language === 'zh'
                  ? `已选 ${selectedIds.size} 个`
                  : `${selectedIds.size} selected`}
              </span>
            </div>
            <Button
              onClick={handleBulkPublish}
              disabled={selectedIds.size === 0 || isPublishing}
              className="gap-2"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              {language === 'zh'
                ? `发布到社区${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`
                : `Publish${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </Button>
          </div>
        )}

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
          <RecipeGrid
            recipes={recipes}
            isLoading={isLoading}
            selectable={selectMode}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        )}

        {/* Count */}
        {recipes.length > 0 && (
          <p className="text-center text-muted-foreground mt-8">
            {recipes.length} {language === 'zh' ? '个收藏菜谱' : (recipes.length === 1 ? 'saved recipe' : 'saved recipes')}
          </p>
        )}
      </div>
    </Layout>
  );
}
