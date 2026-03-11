import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Layers, Loader2, Check, X } from 'lucide-react';

interface RecipeData {
  name: string;
  description: string;
  cuisine: string;
  meal_type: string | string[];
  prep_time: number | null;
  cook_time: number | null;
  difficulty: string;
  calories: number | null;
  ingredients: { name: string; amount: string }[];
  instructions: string[];
  tags: string[];
  image_url: string;
}

interface BulkImportDialogProps {
  onSuccess: () => void;
}

export function BulkImportDialog({ onSuccess }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'preview' | 'saving'>('idle');
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  const handleImport = async () => {
    if (!url.trim()) return;
    setStatus('loading');
    setRecipes([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ url: url.trim() }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Import failed');

      const fetched: RecipeData[] = json.recipes ?? [];
      if (fetched.length === 0) throw new Error('No recipes could be extracted from the images');

      setRecipes(fetched);
      setSelected(new Set(fetched.map((_, i) => i)));
      setStatus('preview');
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setStatus('idle');
    }
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleSave = async () => {
    if (!user || selected.size === 0) return;
    setStatus('saving');

    const toSave = recipes
      .filter((_, i) => selected.has(i))
      .map(r => ({
        name: r.name || 'Untitled Recipe',
        description: r.description || '',
        cuisine: r.cuisine || 'Other',
        meal_type: Array.isArray(r.meal_type) ? r.meal_type : [r.meal_type || 'lunch'],
        prep_time: r.prep_time ?? 0,
        cook_time: r.cook_time ?? 0,
        difficulty: r.difficulty || 'medium',
        calories: r.calories ?? null,
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        instructions: Array.isArray(r.instructions) ? r.instructions : [],
        tags: Array.isArray(r.tags) ? r.tags : [],
        image_url: r.image_url || '',
        user_id: user.id,
        is_published: false,
        save_count: 0,
      }));

    try {
      const { error } = await supabase.from('recipes').insert(toSave);
      if (error) throw error;

      toast({
        title: `${toSave.length} recipe${toSave.length > 1 ? 's' : ''} saved`,
        description: 'Your recipes have been added to My Recipes.',
      });
      setOpen(false);
      resetState();
      onSuccess();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setStatus('preview');
    }
  };

  const resetState = () => {
    setUrl('');
    setRecipes([]);
    setSelected(new Set());
    setStatus('idle');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Layers className="h-4 w-4" />
          批量导入
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>批量导入 — Bulk Import from Xiaohongshu</DialogTitle>
        </DialogHeader>

        {/* URL input */}
        {status === 'idle' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Paste a Xiaohongshu post URL where each photo is a separate recipe. The AI will extract all recipes automatically.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://xhslink.com/... or xiaohongshu.com/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleImport()}
              />
              <Button onClick={handleImport} disabled={!url.trim()}>
                Import
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground text-center">
              Extracting recipes from images…<br />
              This may take 30–60 seconds.
            </p>
          </div>
        )}

        {/* Preview */}
        {status === 'preview' && (
          <>
            <p className="text-sm text-muted-foreground">
              Found <strong>{recipes.length}</strong> recipe{recipes.length > 1 ? 's' : ''}. Select which ones to save.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {recipes.map((r, i) => (
                <div
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected.has(i) ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                  }`}
                >
                  {/* Thumbnail */}
                  {r.image_url && (
                    <img
                      src={r.image_url}
                      alt={r.name}
                      className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.name || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.description}</p>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      {r.cuisine && <span>{r.cuisine}</span>}
                      {r.ingredients?.length > 0 && <span>· {r.ingredients.length} ingredients</span>}
                      {r.instructions?.length > 0 && <span>· {r.instructions.length} steps</span>}
                    </div>
                  </div>

                  <div className="flex-shrink-0 mt-1">
                    {selected.has(i)
                      ? <Check className="h-4 w-4 text-primary" />
                      : <X className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => { resetState(); }}
              >
                Start over
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={selected.size === 0}>
                  Save {selected.size} recipe{selected.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Saving */}
        {status === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Saving recipes…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
