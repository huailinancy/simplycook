import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Images, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface PhotoItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'duplicate';
  recipeName?: string;
  error?: string;
  extractedRecipe?: any;
}

interface BatchImportPhotosProps {
  onComplete: () => void;
  onClose: () => void;
}

export function BatchImportPhotos({ onComplete, onClose }: BatchImportPhotosProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: PhotoItem[] = files.map(file => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return { id, file, preview: URL.createObjectURL(file), status: 'pending' as const };
    });
    setPhotos(prev => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const item = prev.find(p => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(p => p.id !== id);
    });
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const checkDuplicate = async (recipeName: string): Promise<boolean> => {
    if (!user || !recipeName) return false;
    try {
      const { data } = await supabase
        .from('recipes')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', recipeName)
        .limit(1);
      return (data && data.length > 0) || false;
    } catch { return false; }
  };

  const saveRecipe = async (recipe: any) => {
    const { error: insertError } = await supabase.from('recipes').insert({
      name: recipe.name,
      description: recipe.description || null,
      cuisine: recipe.cuisine || null,
      meal_type: recipe.meal_type ? [recipe.meal_type] : [],
      prep_time: recipe.prep_time || null,
      cook_time: recipe.cook_time || null,
      difficulty: recipe.difficulty || null,
      calories: recipe.calories || null,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      tags: recipe.tags || [],
      image_url: recipe.image_url || null,
      author: recipe.author || null,
      source_url: recipe.source_url || null,
      user_id: user!.id,
      is_published: false,
      save_count: 0,
    });
    if (insertError) throw new Error(insertError.message);
  };

  const confirmDuplicate = (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo?.extractedRecipe) return;
    saveRecipe(photo.extractedRecipe).then(() => {
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, status: 'done' } : p));
      onComplete();
    }).catch((err) => {
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, status: 'error', error: err.message } : p));
    });
  };

  const skipDuplicate = (photoId: string) => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, status: 'error', error: language === 'zh' ? '已跳过（重复）' : 'Skipped (duplicate)' } : p));
  };

  const processAll = async () => {
    if (!user || photos.length === 0) return;
    setIsProcessing(true);
    let successCount = 0;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if (photo.status === 'done' || photo.status === 'duplicate') continue;

      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'processing' } : p));

      try {
        const base64 = await fileToBase64(photo.file);
        const { data, error } = await supabase.functions.invoke('scrape-recipe', {
          body: { imageBase64: base64 },
        });

        if (error) throw new Error(error.message);
        const recipe = data?.recipe;
        if (!recipe?.name) throw new Error('No recipe extracted');

        // Check for duplicate
        const isDuplicate = await checkDuplicate(recipe.name);
        if (isDuplicate) {
          setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'duplicate', recipeName: recipe.name, extractedRecipe: recipe } : p));
          continue;
        }

        await saveRecipe(recipe);
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'done', recipeName: recipe.name } : p));
        successCount++;
      } catch (err: any) {
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'error', error: err?.message || 'Failed' } : p));
      }
    }

    setIsProcessing(false);
    if (successCount > 0) {
      toast({
        title: language === 'zh' ? `成功导入 ${successCount} 个食谱` : `${successCount} recipe(s) imported`,
        description: language === 'zh' ? '食谱已保存到你的列表' : 'Recipes saved to your collection',
      });
      onComplete();
    }
  };

  const doneCount = photos.filter(p => p.status === 'done').length;
  const progress = photos.length > 0 ? (doneCount / photos.length) * 100 : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Images className="h-5 w-5 text-primary" />
          {language === 'zh' ? '批量导入食谱' : 'Batch Import Recipes'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {language === 'zh'
            ? '上传多张食谱照片，每张照片提取一个食谱，自动保存。'
            : 'Upload multiple recipe photos. Each photo will be extracted as one recipe and saved automatically.'}
        </p>
      </div>

      {/* Upload area */}
      <div
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">
          {language === 'zh' ? '点击选择照片' : 'Click to select photos'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {language === 'zh' ? '支持多选' : 'Multiple selection supported'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
          disabled={isProcessing}
        />
      </div>

      {/* Photo list */}
      {photos.length > 0 && (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {photos.map((photo) => (
            <Card key={photo.id} className="flex items-center gap-3 p-2">
              <img src={photo.preview} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {photo.status === 'done' && (
                  <p className="text-sm font-medium truncate">{photo.recipeName}</p>
                )}
                {photo.status === 'error' && (
                  <p className="text-sm text-destructive truncate">{photo.error}</p>
                )}
                {photo.status === 'pending' && (
                  <p className="text-sm text-muted-foreground truncate">{photo.file.name}</p>
                )}
                {photo.status === 'processing' && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {language === 'zh' ? '提取中…' : 'Extracting…'}
                  </p>
                )}
                {photo.status === 'duplicate' && (
                  <div>
                    <p className="text-sm font-medium truncate">{photo.recipeName}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      {language === 'zh' ? '已存在同名食谱' : 'Duplicate name found'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-1">
                {photo.status === 'done' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {photo.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                {photo.status === 'pending' && !isProcessing && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePhoto(photo.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                {photo.status === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                {photo.status === 'duplicate' && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => confirmDuplicate(photo.id)}>
                      {language === 'zh' ? '仍然导入' : 'Import'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => skipDuplicate(photo.id)}>
                      {language === 'zh' ? '跳过' : 'Skip'}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {doneCount} / {photos.length}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={isProcessing}>
          {language === 'zh' ? '关闭' : 'Close'}
        </Button>
        <Button
          onClick={processAll}
          disabled={photos.filter(p => p.status === 'pending' || p.status === 'error').length === 0 || isProcessing}
          className="btn-primary-gradient border-0"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {language === 'zh' ? '处理中…' : 'Processing…'}
            </>
          ) : (
            <>
              {language === 'zh' ? `提取全部 (${photos.filter(p => p.status !== 'done').length})` : `Extract All (${photos.filter(p => p.status !== 'done').length})`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
