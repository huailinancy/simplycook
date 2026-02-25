import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { ImportRecipeForm } from '@/components/recipe/ImportRecipeForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, SupabaseRecipe, toAppRecipe } from '@/types/recipe';
import { Import, Plus, Globe, Lock, Heart, Pencil, LogIn, CheckSquare, Download, Trash2, X, FileText, FileSpreadsheet, Images } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadMultipleRecipesAsPdf, downloadMultipleRecipesAsCsv } from '@/lib/recipeDownload';
import { BatchImportPhotos } from '@/components/recipe/BatchImportPhotos';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MyRecipes() {
  const [recipes, setRecipes] = useState<SupabaseRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<SupabaseRecipe | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchImport, setShowBatchImport] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const fetchMyRecipes = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes(data as SupabaseRecipe[]);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your recipes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyRecipes();
    }
  }, [user]);

  const handleCreateRecipe = async (recipeData: {
    name: string;
    description: string;
    cuisine: string;
    meal_type: string[];
    prep_time: number;
    cook_time: number;
    difficulty: string;
    calories: number;
    ingredients: { name: string; amount: string }[];
    instructions: string[];
    image_url: string;
    tags: string[];
    source_url: string;
    author: string;
  }) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('recipes')
        .insert({
          ...recipeData,
          user_id: user.id,
          is_published: false,
          save_count: 0,
        });

      if (error) throw error;

      toast({
        title: 'Recipe created',
        description: 'Your recipe has been saved',
      });

      setShowForm(false);
      fetchMyRecipes();
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast({
        title: 'Error',
        description: 'Failed to create recipe',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRecipe = async (recipeData: {
    name: string;
    description: string;
    cuisine: string;
    meal_type: string[];
    prep_time: number;
    cook_time: number;
    difficulty: string;
    calories: number;
    ingredients: { name: string; amount: string }[];
    instructions: string[];
    image_url: string;
    tags: string[];
    source_url: string;
    author: string;
  }) => {
    if (!user || !editingRecipe) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('recipes')
        .update(recipeData)
        .eq('id', editingRecipe.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Recipe updated',
        description: 'Your recipe has been updated',
      });

      setEditingRecipe(null);
      fetchMyRecipes();
    } catch (error) {
      console.error('Error updating recipe:', error);
      toast({
        title: 'Error',
        description: 'Failed to update recipe',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (recipeId: number, currentPublished: boolean) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .update({ is_published: !currentPublished })
        .eq('id', recipeId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: currentPublished ? 'Recipe unpublished' : 'Recipe published',
        description: currentPublished
          ? 'Your recipe is now private'
          : 'Your recipe is now visible to the community',
      });

      fetchMyRecipes();
    } catch (error) {
      console.error('Error toggling publish:', error);
      toast({
        title: 'Error',
        description: 'Failed to update recipe',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRecipe = async (recipeId: number) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Recipe deleted',
        description: 'Your recipe has been removed',
      });

      fetchMyRecipes();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete recipe',
        variant: 'destructive',
      });
    }
  };

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === recipes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recipes.map(r => r.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectedRecipes = recipes.filter(r => selectedIds.has(r.id));

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} recipe(s)?`)) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .in('id', Array.from(selectedIds))
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: `${selectedIds.size} recipe(s) deleted`,
        description: 'Selected recipes have been removed',
      });

      exitSelectionMode();
      fetchMyRecipes();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete recipes',
        variant: 'destructive',
      });
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

  // Show sign-in prompt for non-authenticated users
  if (!user) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="text-center py-16">
            <Import className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('myRecipes.signInTitle')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('myRecipes.signInDesc')}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Import className="h-8 w-8 text-primary" />
              <h1 className="font-display text-3xl md:text-4xl font-bold">
                {t('myRecipes.title')}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {t('myRecipes.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Select mode toggle */}
            {recipes.length > 0 && !selectionMode && (
              <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                <CheckSquare className="h-4 w-4 mr-2" />
                {language === 'zh' ? '选择' : 'Select'}
              </Button>
            )}

            <Button variant="outline" onClick={() => setShowBatchImport(true)}>
              <Images className="h-4 w-4 mr-2" />
              {language === 'zh' ? '批量导入' : 'Batch Import'}
            </Button>

            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button className="btn-primary-gradient border-0">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('myRecipes.addRecipe')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <ImportRecipeForm
                  onSubmit={handleCreateRecipe}
                  isSubmitting={isSubmitting}
                  onCancel={() => setShowForm(false)}
                  mode="create"
                />
              </DialogContent>
            </Dialog>

            {/* Batch Import Dialog */}
            <Dialog open={showBatchImport} onOpenChange={setShowBatchImport}>
              <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
                <BatchImportPhotos
                  onComplete={() => { fetchMyRecipes(); }}
                  onClose={() => setShowBatchImport(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Selection toolbar */}
        {selectionMode && (
          <div className="flex items-center justify-between gap-3 mb-6 p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={recipes.length > 0 && selectedIds.size === recipes.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0
                  ? (language === 'zh' ? `已选择 ${selectedIds.size} 个` : `${selectedIds.size} selected`)
                  : (language === 'zh' ? '全选' : 'Select all')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={selectedIds.size === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'zh' ? '下载' : 'Download'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => downloadMultipleRecipesAsPdf(selectedRecipes, language)}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadMultipleRecipesAsCsv(selectedRecipes, language)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="destructive" disabled={selectedIds.size === 0} onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                {language === 'zh' ? '删除' : 'Delete'}
              </Button>
              <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingRecipe} onOpenChange={(open) => !open && setEditingRecipe(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <ImportRecipeForm
              onSubmit={handleEditRecipe}
              isSubmitting={isSubmitting}
              onCancel={() => setEditingRecipe(null)}
              initialData={editingRecipe}
              mode="edit"
            />
          </DialogContent>
        </Dialog>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden shadow-soft">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && recipes.length === 0 && (
          <div className="text-center py-16">
            <Import className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('myRecipes.empty')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('myRecipes.emptyDesc')}
            </p>
            <Button onClick={() => setShowForm(true)} className="btn-primary-gradient border-0">
              <Plus className="h-4 w-4 mr-2" />
              {t('myRecipes.addFirst')}
            </Button>
          </div>
        )}

        {/* Recipe grid */}
        {!isLoading && recipes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className={`relative group ${selectionMode ? 'cursor-pointer' : ''} ${selectionMode && selectedIds.has(recipe.id) ? 'ring-2 ring-primary rounded-xl' : ''}`}
                onClick={selectionMode ? (e) => { e.preventDefault(); toggleSelect(recipe.id); } : undefined}
              >
                {/* Selection checkbox */}
                {selectionMode && (
                  <div className="absolute top-3 left-3 z-20">
                    <Checkbox
                      checked={selectedIds.has(recipe.id)}
                      onCheckedChange={() => toggleSelect(recipe.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-background/90 backdrop-blur-sm"
                    />
                  </div>
                )}
                <RecipeCard
                  recipe={toAppRecipe(recipe, language, user?.email?.split('@')[0] || 'Me')}
                  saveCount={recipe.save_count}
                />

                {/* Recipe controls overlay */}
                <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-none">
                  {/* Status badge */}
                  <Badge
                    variant={recipe.is_published ? "default" : "secondary"}
                    className={recipe.is_published ? "bg-herb text-herb-foreground" : ""}
                  >
                    {recipe.is_published ? (
                      <>
                        <Globe className="h-3 w-3 mr-1" />
                        {t('myRecipes.published')}
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        {t('myRecipes.private')}
                      </>
                    )}
                  </Badge>

                  {/* Save count if published */}
                  {recipe.is_published && recipe.save_count > 0 && (
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                      <Heart className="h-3 w-3 mr-1 text-rose-500 fill-rose-500" />
                      {recipe.save_count}
                    </Badge>
                  )}
                </div>

                {/* Action buttons - hidden in selection mode */}
                {!selectionMode && <div className="absolute bottom-0 left-0 right-0 p-3 pt-8 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-2">
                    {/* Edit button */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditingRecipe(recipe);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {t('myRecipes.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant={recipe.is_published ? "secondary" : "default"}
                      className="flex-1"
                      onClick={(e) => {
                        e.preventDefault();
                        handleTogglePublish(recipe.id, recipe.is_published);
                      }}
                    >
                      {recipe.is_published ? (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          {t('myRecipes.unpublish')}
                        </>
                      ) : (
                        <>
                          <Globe className="h-3 w-3 mr-1" />
                          {t('myRecipes.publish')}
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteRecipe(recipe.id);
                      }}
                    >
                      {t('myRecipes.delete')}
                    </Button>
                  </div>
                </div>}
              </div>
            ))}
          </div>
        )}

        {/* Count */}
        {recipes.length > 0 && (
          <p className="text-center text-muted-foreground mt-8">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </p>
        )}
      </div>
    </Layout>
  );
}
