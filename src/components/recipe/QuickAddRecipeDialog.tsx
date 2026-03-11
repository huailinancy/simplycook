import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSavedRecipesContext } from '@/contexts/SavedRecipesContext';

interface QuickAddRecipeDialogProps {
  onRecipesAdded?: () => void;
}

export function QuickAddRecipeDialog({ onRecipesAdded }: QuickAddRecipeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshSavedRecipes } = useSavedRecipesContext();

  // Single recipe fields
  const [singleName, setSingleName] = useState('');
  const [singleDescription, setSingleDescription] = useState('');
  const [singleIngredients, setSingleIngredients] = useState('');
  const [singleInstructions, setSingleInstructions] = useState('');

  // Batch field
  const [batchNames, setBatchNames] = useState('');

  const resetForm = () => {
    setSingleName('');
    setSingleDescription('');
    setSingleIngredients('');
    setSingleInstructions('');
    setBatchNames('');
  };

  const createRecipesAndSave = async (names: string[]) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Insert recipes
      // Fetch user display name for author field
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const authorName = profile?.display_name || user.email?.split('@')[0] || 'User';

      const recipesToInsert = names.map(name => ({
        name: name.trim(),
        user_id: user.id,
        is_published: false,
        author: authorName,
        ingredients: [] as any[],
        instructions: [] as any[],
        tags: [] as any[],
        meal_type: [] as any[],
        macros: {} as any,
      }));

      const { data: insertedRecipes, error: insertError } = await supabase
        .from('recipes')
        .insert(recipesToInsert)
        .select('id');

      if (insertError) throw insertError;

      // Auto-save all created recipes
      if (insertedRecipes && insertedRecipes.length > 0) {
        const savedEntries = insertedRecipes.map(r => ({
          user_id: user.id,
          recipe_id: r.id,
        }));

        const { error: saveError } = await supabase
          .from('saved_recipes')
          .insert(savedEntries);

        if (saveError) throw saveError;
      }

      await refreshSavedRecipes();
      onRecipesAdded?.();

      toast({
        title: language === 'zh' ? '添加成功' : 'Recipes added',
        description: language === 'zh'
          ? `已成功添加 ${names.length} 个菜谱`
          : `Successfully added ${names.length} recipe${names.length > 1 ? 's' : ''}`,
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error('Error creating recipes:', error);
      toast({
        title: language === 'zh' ? '添加失败' : 'Error',
        description: language === 'zh' ? '创建菜谱时出错' : 'Failed to create recipes',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleSubmit = async () => {
    if (!singleName.trim()) return;

    if (!user) return;
    setIsSubmitting(true);
    try {
      const ingredients = singleIngredients.trim()
        ? singleIngredients.split('\n').filter(Boolean).map(line => ({
            name: line.trim(),
            amount: '',
          }))
        : [];

      const instructions = singleInstructions.trim()
        ? singleInstructions.split('\n').filter(Boolean)
        : [];

      const { data: insertedRecipes, error: insertError } = await supabase
        .from('recipes')
        .insert({
          name: singleName.trim(),
          description: singleDescription.trim() || null,
          user_id: user.id,
          is_published: false,
          ingredients: ingredients as any,
          instructions: instructions as any,
          tags: [] as any,
          meal_type: [] as any,
          macros: {} as any,
        })
        .select('id');

      if (insertError) throw insertError;

      if (insertedRecipes && insertedRecipes.length > 0) {
        const { error: saveError } = await supabase
          .from('saved_recipes')
          .insert({
            user_id: user.id,
            recipe_id: insertedRecipes[0].id,
          });

        if (saveError) throw saveError;
      }

      await refreshSavedRecipes();
      onRecipesAdded?.();

      toast({
        title: language === 'zh' ? '添加成功' : 'Recipe added',
        description: language === 'zh' ? '菜谱已添加到收藏' : 'Recipe added to your saved list',
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast({
        title: language === 'zh' ? '添加失败' : 'Error',
        description: language === 'zh' ? '创建菜谱时出错' : 'Failed to create recipe',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchSubmit = async () => {
    // Split by Chinese semicolon, English semicolon, or newline
    const names = batchNames
      .split(/[；;|\n]/)
      .map(n => n.trim())
      .filter(Boolean);

    if (names.length === 0) return;
    await createRecipesAndSave(names);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {language === 'zh' ? '添加菜谱' : 'Add Recipe'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{language === 'zh' ? '添加菜谱' : 'Add Recipe'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="single" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              {language === 'zh' ? '单个添加' : 'Single'}
            </TabsTrigger>
            <TabsTrigger value="batch">
              {language === 'zh' ? '批量添加' : 'Batch'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{language === 'zh' ? '菜名 *' : 'Recipe Name *'}</Label>
              <Input
                value={singleName}
                onChange={e => setSingleName(e.target.value)}
                placeholder={language === 'zh' ? '例如：丁丁炒面' : 'e.g. Stir-fried noodles'}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'zh' ? '描述' : 'Description'}</Label>
              <Input
                value={singleDescription}
                onChange={e => setSingleDescription(e.target.value)}
                placeholder={language === 'zh' ? '简单描述这道菜（选填）' : 'Brief description (optional)'}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'zh' ? '食材（每行一个）' : 'Ingredients (one per line)'}</Label>
              <Textarea
                value={singleIngredients}
                onChange={e => setSingleIngredients(e.target.value)}
                placeholder={language === 'zh' ? '面条 200g\n牛肉 100g\n洋葱 半个' : 'Noodles 200g\nBeef 100g\nOnion 1/2'}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'zh' ? '做法步骤（每行一步）' : 'Instructions (one per line)'}</Label>
              <Textarea
                value={singleInstructions}
                onChange={e => setSingleInstructions(e.target.value)}
                placeholder={language === 'zh' ? '1. 面条煮熟备用\n2. 牛肉切丁炒熟' : '1. Cook noodles\n2. Stir-fry beef'}
                rows={4}
              />
            </div>
            <Button
              onClick={handleSingleSubmit}
              disabled={!singleName.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {language === 'zh' ? '添加菜谱' : 'Add Recipe'}
            </Button>
          </TabsContent>

          <TabsContent value="batch" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{language === 'zh' ? '菜名（用分号或换行分隔）' : 'Recipe names (separated by ; or newline)'}</Label>
              <Textarea
                value={batchNames}
                onChange={e => setBatchNames(e.target.value)}
                placeholder={language === 'zh'
                  ? '丁丁炒面；过油肉拌面；干煸二节子炒面'
                  : 'Recipe 1; Recipe 2; Recipe 3'}
                rows={5}
              />
              {batchNames.trim() && (
                <p className="text-xs text-muted-foreground">
                  {language === 'zh'
                    ? `将创建 ${batchNames.split(/[；;|\n]/).map(n => n.trim()).filter(Boolean).length} 个菜谱`
                    : `Will create ${batchNames.split(/[；;|\n]/).map(n => n.trim()).filter(Boolean).length} recipes`}
                </p>
              )}
            </div>
            <Button
              onClick={handleBatchSubmit}
              disabled={!batchNames.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {language === 'zh' ? '批量添加' : 'Add All'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
