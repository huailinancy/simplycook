import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { ImportRecipeForm } from '@/components/recipe/ImportRecipeForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, SupabaseRecipe, toAppRecipe } from '@/types/recipe';
import { Import, Plus, Globe, Lock, Heart, Pencil, LogIn, CheckSquare, Download, Trash2, X, FileText, FileSpreadsheet, Images, FolderPlus, Folder, MoreHorizontal, Tag, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadMultipleRecipesAsPdf, downloadMultipleRecipesAsCsv } from '@/lib/recipeDownload';
import { BatchImportPhotos } from '@/components/recipe/BatchImportPhotos';
import { useRecipeCategories } from '@/hooks/useRecipeCategories';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Draggable recipe card wrapper
function DraggableRecipeCard({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${id}`,
    data: { recipeId: id },
  });

  return (
    <div ref={setNodeRef} className={`relative ${isDragging ? 'opacity-30' : ''}`}>
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="absolute top-3 left-3 z-30 cursor-grab active:cursor-grabbing p-1 rounded bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

// Droppable category button
function DroppableCategoryButton({
  categoryId,
  isActive,
  label,
  count,
  onClick,
  isOver,
}: {
  categoryId: string;
  isActive: boolean;
  label: string;
  count: number;
  onClick: () => void;
  isOver?: boolean;
}) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({
    id: `category-${categoryId}`,
    data: { categoryId },
  });

  const over = isOver ?? dndIsOver;

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
        cursor-pointer select-none flex flex-col items-center justify-center gap-1.5
        min-w-[100px] w-[110px] h-[100px] rounded-lg border-2 p-3
        transition-all duration-200 text-center
        ${isActive
          ? 'border-primary bg-primary/10 shadow-md'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/60'}
        ${over ? 'ring-2 ring-primary border-primary bg-primary/15 scale-105 shadow-lg' : ''}
      `}
    >
      <Folder className={`h-8 w-8 ${isActive ? 'text-primary' : 'text-muted-foreground'} ${over ? 'text-primary' : ''}`} />
      <span className={`text-xs font-medium leading-tight line-clamp-2 ${isActive ? 'text-primary' : 'text-foreground'}`}>
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground">({count})</span>
    </div>
  );
}

export default function MyRecipes() {
  const [recipes, setRecipes] = useState<SupabaseRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<SupabaseRecipe | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [draggingRecipeId, setDraggingRecipeId] = useState<number | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const {
    categories,
    addCategory,
    renameCategory,
    deleteCategory,
    assignRecipesToCategory,
    fetchCategories,
  } = useRecipeCategories();

  // DnD sensors with activation distance to avoid interfering with clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

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

  const filteredRecipes = activeCategoryFilter === null
    ? recipes
    : activeCategoryFilter === 'uncategorized'
      ? recipes.filter(r => !r.category_id)
      : recipes.filter(r => r.category_id === activeCategoryFilter);

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

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecipes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecipes.map(r => r.id)));
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

  const handleAssignToCategory = async (categoryId: string | null) => {
    if (selectedIds.size === 0) return;
    const success = await assignRecipesToCategory(Array.from(selectedIds), categoryId);
    if (success) {
      toast({
        title: language === 'zh' ? '已分配分类' : 'Category assigned',
        description: language === 'zh'
          ? `${selectedIds.size} 个食谱已更新`
          : `${selectedIds.size} recipe(s) updated`,
      });
      exitSelectionMode();
      fetchMyRecipes();
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const cat = await addCategory(newCategoryName.trim());
    if (cat) {
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      toast({
        title: language === 'zh' ? '分类已创建' : 'Category created',
        description: cat.name,
      });
    }
  };

  const handleRenameCategory = async (id: string) => {
    if (!renamingValue.trim()) return;
    await renameCategory(id, renamingValue.trim());
    setRenamingCategoryId(null);
    setRenamingValue('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(language === 'zh' ? '确定删除此分类？食谱不会被删除。' : 'Delete this category? Recipes will not be deleted.')) return;
    await deleteCategory(id);
    if (activeCategoryFilter === id) setActiveCategoryFilter(null);
    fetchMyRecipes();
  };

  const getCategoryRecipeCount = (categoryId: string) => {
    return recipes.filter(r => r.category_id === categoryId).length;
  };

  const uncategorizedCount = recipes.filter(r => !r.category_id).length;

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const recipeId = event.active.data.current?.recipeId as number;
    setDraggingRecipeId(recipeId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingRecipeId(null);
    const { active, over } = event;
    if (!over) return;

    const recipeId = active.data.current?.recipeId as number;
    const droppableId = over.id as string;

    let categoryId: string | null = null;
    if (droppableId === 'category-uncategorized') {
      categoryId = null;
    } else if (droppableId.startsWith('category-')) {
      categoryId = droppableId.replace('category-', '');
    } else {
      return;
    }

    // Check if recipe is already in this category
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe && recipe.category_id === categoryId) return;

    const success = await assignRecipesToCategory([recipeId], categoryId);
    if (success) {
      const catName = categoryId
        ? categories.find(c => c.id === categoryId)?.name
        : (language === 'zh' ? '未分类' : 'Uncategorized');
      toast({
        title: language === 'zh' ? '已移动' : 'Moved',
        description: language === 'zh' ? `已移至「${catName}」` : `Moved to "${catName}"`,
      });
      fetchMyRecipes();
    }
  };

  const draggingRecipe = draggingRecipeId ? recipes.find(r => r.id === draggingRecipeId) : null;

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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="container py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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

          {/* Drag hint */}
          {draggingRecipeId && (
            <div className="mb-2 text-xs text-muted-foreground text-center animate-fade-in">
              {language === 'zh' ? '拖到下方分类标签上即可分配' : 'Drop onto a category below to assign'}
            </div>
          )}

          {/* Category Bar */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Folder className="h-5 w-5 text-primary" />
              <span className="text-base font-semibold">{language === 'zh' ? '分类' : 'Categories'}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setShowNewCategoryInput(true)}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>

            {showNewCategoryInput && (
              <div className="flex items-center gap-2 mb-3">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={language === 'zh' ? '分类名称...' : 'Category name...'}
                  className="h-8 w-48 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory();
                    if (e.key === 'Escape') { setShowNewCategoryInput(false); setNewCategoryName(''); }
                  }}
                  autoFocus
                />
                <Button size="sm" className="h-8" onClick={handleAddCategory}>
                  {language === 'zh' ? '添加' : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {/* All filter */}
              <div
                onClick={() => setActiveCategoryFilter(null)}
                className={`
                  cursor-pointer select-none flex flex-col items-center justify-center gap-1.5
                  min-w-[100px] w-[110px] h-[100px] rounded-lg border-2 p-3
                  transition-all duration-200 text-center
                  ${activeCategoryFilter === null
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/60'}
                `}
              >
                <Folder className={`h-8 w-8 ${activeCategoryFilter === null ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-medium ${activeCategoryFilter === null ? 'text-primary' : 'text-foreground'}`}>
                  {language === 'zh' ? '全部' : 'All'}
                </span>
                <span className="text-[10px] text-muted-foreground">({recipes.length})</span>
              </div>

              {/* Category filters - droppable */}
              {categories.map((cat) => (
                <div key={cat.id} className="relative group/cat">
                  {renamingCategoryId === cat.id ? (
                    <div className="flex flex-col items-center gap-1 w-[110px] h-[100px] justify-center">
                      <Input
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        className="h-7 w-full text-xs text-center"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCategory(cat.id);
                          if (e.key === 'Escape') setRenamingCategoryId(null);
                        }}
                        autoFocus
                      />
                      <Button size="sm" className="h-6 px-3 text-xs" onClick={() => handleRenameCategory(cat.id)}>✓</Button>
                    </div>
                  ) : (
                    <>
                      <DroppableCategoryButton
                        categoryId={cat.id}
                        isActive={activeCategoryFilter === cat.id}
                        label={cat.name}
                        count={getCategoryRecipeCount(cat.id)}
                        onClick={() => setActiveCategoryFilter(cat.id)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute -top-1 -right-1 h-6 w-6 px-0 rounded-full bg-background border border-border opacity-0 group-hover/cat:opacity-100 transition-opacity shadow-sm"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => { setRenamingCategoryId(cat.id); setRenamingValue(cat.name); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            {language === 'zh' ? '重命名' : 'Rename'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            {language === 'zh' ? '删除' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))}

              {/* Uncategorized filter - also droppable */}
              {uncategorizedCount > 0 && (
                <DroppableCategoryButton
                  categoryId="uncategorized"
                  isActive={activeCategoryFilter === 'uncategorized'}
                  label={language === 'zh' ? '未分类' : 'Uncategorized'}
                  count={uncategorizedCount}
                  onClick={() => setActiveCategoryFilter('uncategorized')}
                />
              )}
            </div>
          </div>

          {/* Selection toolbar */}
          {selectionMode && (
            <div className="flex items-center justify-between gap-3 mb-6 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filteredRecipes.length > 0 && selectedIds.size === filteredRecipes.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size > 0
                    ? (language === 'zh' ? `已选择 ${selectedIds.size} 个` : `${selectedIds.size} selected`)
                    : (language === 'zh' ? '全选' : 'Select all')}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={selectedIds.size === 0}>
                      <Tag className="h-4 w-4 mr-2" />
                      {language === 'zh' ? '分配分类' : 'Assign Category'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {categories.map((cat) => (
                      <DropdownMenuItem key={cat.id} onClick={() => handleAssignToCategory(cat.id)}>
                        <Folder className="h-4 w-4 mr-2" />
                        {cat.name}
                      </DropdownMenuItem>
                    ))}
                    {categories.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={() => handleAssignToCategory(null)}>
                      <X className="h-4 w-4 mr-2" />
                      {language === 'zh' ? '移除分类' : 'Remove Category'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

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
          {!isLoading && filteredRecipes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRecipes.map((recipe) => {
                const categoryName = categories.find(c => c.id === recipe.category_id)?.name;
                return (
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

                    {/* Wrap in draggable when not in selection mode */}
                    {!selectionMode ? (
                      <DraggableRecipeCard id={recipe.id}>
                        <RecipeCard
                          recipe={toAppRecipe(recipe, language, user?.email?.split('@')[0] || 'Me')}
                          saveCount={recipe.save_count}
                        />
                      </DraggableRecipeCard>
                    ) : (
                      <RecipeCard
                        recipe={toAppRecipe(recipe, language, user?.email?.split('@')[0] || 'Me')}
                        saveCount={recipe.save_count}
                      />
                    )}

                    {/* Category badge */}
                    {categoryName && (
                      <div className="absolute top-3 right-3 z-10">
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-[10px]">
                          <Folder className="h-2.5 w-2.5 mr-1" />
                          {categoryName}
                        </Badge>
                      </div>
                    )}

                    {/* Recipe controls overlay */}
                    <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-none">
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

                      {recipe.is_published && recipe.save_count > 0 && (
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                          <Heart className="h-3 w-3 mr-1 text-rose-500 fill-rose-500" />
                          {recipe.save_count}
                        </Badge>
                      )}
                    </div>

                    {/* Action buttons */}
                    {!selectionMode && <div className="absolute bottom-0 left-0 right-0 p-3 pt-8 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-2">
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
                );
              })}
            </div>
          )}

          {/* Empty filtered state */}
          {!isLoading && recipes.length > 0 && filteredRecipes.length === 0 && (
            <div className="text-center py-16">
              <Folder className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {language === 'zh' ? '该分类下没有食谱' : 'No recipes in this category'}
              </p>
            </div>
          )}

          {/* Count */}
          {filteredRecipes.length > 0 && (
            <p className="text-center text-muted-foreground mt-8">
              {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
            </p>
          )}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggingRecipe && (
            <div className="w-48 opacity-80 shadow-xl rounded-xl overflow-hidden pointer-events-none">
              <img
                src={draggingRecipe.image_url || '/placeholder.svg'}
                alt={draggingRecipe.name}
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="p-2 bg-card">
                <p className="text-xs font-medium truncate">{draggingRecipe.name}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </Layout>
  );
}
