import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseRecipe, getLocalizedRecipe } from '@/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedRecipesContext } from '@/contexts/SavedRecipesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Clock, Flame, ChefHat, Bookmark, Heart, ExternalLink, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { downloadRecipeAsPdf, downloadRecipeAsCsv } from '@/lib/recipeDownload';
import { cn } from '@/lib/utils';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<SupabaseRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isRecipeSaved, toggleSave } = useSavedRecipesContext();
  const { language, t } = useLanguage();

  const recipeId = id ? parseInt(id) : 0;
  const isSaved = isRecipeSaved(recipeId);

  // Get localized content
  const localizedContent = recipe ? getLocalizedRecipe(recipe, language) : null;

  useEffect(() => {
    async function fetchRecipe() {
      if (!id) return;

      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error) {
        console.error('Error fetching recipe:', error);
      } else {
        setRecipe(data as SupabaseRecipe);
      }
      setLoading(false);
    }

    fetchRecipe();
  }, [id]);

  const handleSaveClick = async () => {
    if (!user || !recipeId) return;
    await toggleSave(recipeId);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!recipe) {
    return (
      <Layout>
        <div className="container py-8">
          <h1 className="text-2xl font-bold">{language === 'zh' ? '找不到食谱' : 'Recipe not found'}</h1>
          <Link to="/recipes">
            <Button className="mt-4">{language === 'zh' ? '返回食谱' : 'Back to Recipes'}</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Link to="/recipes">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {language === 'zh' ? '返回食谱' : 'Back to Recipes'}
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            {/* Download button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  {language === 'zh' ? '下载' : 'Download'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => recipe && downloadRecipeAsPdf(recipe, language)}>
                  {language === 'zh' ? '下载 PDF' : 'Download PDF'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => recipe && downloadRecipeAsCsv(recipe, language)}>
                  {language === 'zh' ? '下载 CSV' : 'Download CSV'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Save button */}
            {user && (
              <Button
                variant={isSaved ? "secondary" : "outline"}
                className={cn(
                  "gap-2",
                  isSaved && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={handleSaveClick}
              >
                <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
                {isSaved ? (language === 'zh' ? '已收藏' : 'Saved') : (language === 'zh' ? '收藏食谱' : 'Save Recipe')}
              </Button>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="relative aspect-video overflow-hidden rounded-xl mb-6">
          <img
            src={recipe.image_url || '/placeholder-recipe.jpg'}
            alt={recipe.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {localizedContent?.name || recipe.name}
          </h1>

          {/* Save count */}
          {recipe.save_count > 0 && (
            <Badge variant="secondary" className="gap-1 flex-shrink-0">
              <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
              {recipe.save_count} {recipe.save_count === 1 ? (language === 'zh' ? '次收藏' : 'save') : (language === 'zh' ? '次收藏' : 'saves')}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 my-4">
          {totalTime > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-4 w-4" /> {totalTime} min
            </Badge>
          )}
          {recipe.calories && (
            <Badge variant="secondary" className="gap-1">
              <Flame className="h-4 w-4" /> {recipe.calories} cal
            </Badge>
          )}
          {recipe.difficulty && (
            <Badge variant="secondary" className="gap-1">
              <ChefHat className="h-4 w-4" /> {recipe.difficulty}
            </Badge>
          )}
          {recipe.cuisine && (
            <Badge variant="outline">{recipe.cuisine}</Badge>
          )}
        </div>

        {/* Source link */}
        {(recipe as any).source_url && (
          <a href={(recipe as any).source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-6">
            <ExternalLink className="h-4 w-4" />
            {language === 'zh' ? '查看原始来源' : 'View original source'}
          </a>
        )}

        {/* Description */}
        {(localizedContent?.description || recipe.description) && (
          <p className="text-muted-foreground mb-6">{localizedContent?.description || recipe.description}</p>
        )}

        {/* Ingredients */}
        {localizedContent?.ingredients && localizedContent.ingredients.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{language === 'zh' ? '食材' : 'Ingredients'}</h2>
            <ul className="grid sm:grid-cols-2 gap-2">
              {localizedContent.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-primary">•</span>
                  {ing.amount} {ing.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {localizedContent?.instructions && localizedContent.instructions.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">{language === 'zh' ? '做法' : 'Instructions'}</h2>
            <ol className="space-y-4">
              {localizedContent.instructions.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </span>
                  <p className="pt-1">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Layout>
  );
}
