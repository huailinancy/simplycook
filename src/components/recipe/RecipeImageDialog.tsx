import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, Trash2, Loader2, ImageOff } from 'lucide-react';

interface RecipeImageDialogProps {
  recipeId: number;
  currentImageUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (newUrl: string | null) => void;
}

export function RecipeImageDialog({
  recipeId,
  currentImageUrl,
  open,
  onOpenChange,
  onUpdated,
}: RecipeImageDialogProps) {
  const [preview, setPreview] = useState<string>(currentImageUrl || '');
  const [urlInput, setUrlInput] = useState<string>(currentImageUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Local preview immediately
    const reader = new FileReader();
    reader.onload = ev => {
      setPreview(ev.target?.result as string);
      setUrlInput('');
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `user-${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
      setUrlInput(urlData.publicUrl);
      setPreview(urlData.publicUrl);
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload image.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newUrl = urlInput.trim() || null;
      const { error } = await supabase
        .from('recipes')
        .update({ image_url: newUrl })
        .eq('id', recipeId)
        .eq('user_id', user!.id);
      if (error) throw error;
      toast({ title: newUrl ? 'Photo updated' : 'Photo removed' });
      onUpdated(newUrl);
      onOpenChange(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = () => {
    setPreview('');
    setUrlInput('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Recipe Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="w-full aspect-video rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
            {preview ? (
              <img
                src={preview}
                alt="Recipe"
                className="w-full h-full object-cover"
                onError={() => setPreview('')}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <span className="text-sm">No photo</span>
              </div>
            )}
          </div>

          {/* URL input */}
          <div className="space-y-1.5">
            <Label className="text-sm">Paste a public image URL</Label>
            <Input
              type="url"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setPreview(e.target.value); }}
              placeholder="https://example.com/image.jpg"
              disabled={isUploading}
            />
          </div>

          {/* Upload button */}
          <div className="space-y-1.5">
            <Label className="text-sm">Or upload from your device</Label>
            <label className="cursor-pointer block">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <div className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploading ? 'Uploading…' : 'Choose file'}
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {(preview || urlInput) && (
              <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
            <Button
              className="btn-primary-gradient border-0 flex-1"
              onClick={handleSave}
              disabled={isSaving || isUploading}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
