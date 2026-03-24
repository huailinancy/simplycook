import { useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Camera, Plus, X, UtensilsCrossed, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface FoodLogEntry {
  id?: string;
  meal_type: MealType;
  description: string;
  photo_url: string | null;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export default function FoodLog() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<Record<MealType, FoodLogEntry>>({
    breakfast: { meal_type: 'breakfast', description: '', photo_url: null },
    lunch: { meal_type: 'lunch', description: '', photo_url: null },
    dinner: { meal_type: 'dinner', description: '', photo_url: null },
  });
  const [uploading, setUploading] = useState<MealType | null>(null);
  const [saving, setSaving] = useState(false);

  const mealLabels: Record<MealType, string> = {
    breakfast: language === 'zh' ? '早餐' : 'Breakfast',
    lunch: language === 'zh' ? '午餐' : 'Lunch',
    dinner: language === 'zh' ? '晚餐' : 'Dinner',
  };

  const mealIcons: Record<MealType, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
  };

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', dateStr);

    if (error) {
      console.error('Error fetching food logs:', error);
      return;
    }

    const newEntries: Record<MealType, FoodLogEntry> = {
      breakfast: { meal_type: 'breakfast', description: '', photo_url: null },
      lunch: { meal_type: 'lunch', description: '', photo_url: null },
      dinner: { meal_type: 'dinner', description: '', photo_url: null },
    };

    data?.forEach((row: any) => {
      const mt = row.meal_type as MealType;
      if (MEAL_TYPES.includes(mt)) {
        newEntries[mt] = {
          id: row.id,
          meal_type: mt,
          description: row.description || '',
          photo_url: row.photo_url,
        };
      }
    });

    setEntries(newEntries);
  }, [user, dateStr]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handlePhotoUpload = async (mealType: MealType, file: File) => {
    if (!user) return;
    setUploading(mealType);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${dateStr}/${mealType}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('food-log-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('food-log-photos')
        .getPublicUrl(filePath);

      const photoUrl = urlData.publicUrl + '?t=' + Date.now();

      setEntries(prev => ({
        ...prev,
        [mealType]: { ...prev[mealType], photo_url: photoUrl },
      }));

      // Auto-save after photo upload
      await saveEntry(mealType, entries[mealType].description, photoUrl);

      toast({
        title: language === 'zh' ? '照片已上传' : 'Photo uploaded',
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({
        title: language === 'zh' ? '上传失败' : 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const saveEntry = async (mealType: MealType, description: string, photoUrl: string | null) => {
    if (!user) return;
    const entry = entries[mealType];

    const payload = {
      user_id: user.id,
      log_date: dateStr,
      meal_type: mealType,
      description: description || entry.description,
      photo_url: photoUrl ?? entry.photo_url,
    };

    const { error } = await supabase
      .from('food_logs')
      .upsert(payload, { onConflict: 'user_id,log_date,meal_type' });

    if (error) {
      console.error('Save error:', error);
    }
  };

  const handleDescriptionChange = (mealType: MealType, value: string) => {
    setEntries(prev => ({
      ...prev,
      [mealType]: { ...prev[mealType], description: value },
    }));
  };

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const mealType of MEAL_TYPES) {
        const entry = entries[mealType];
        if (entry.description || entry.photo_url) {
          await saveEntry(mealType, entry.description, entry.photo_url);
        }
      }
      toast({
        title: language === 'zh' ? '已保存' : 'Saved',
        description: language === 'zh' ? '今日饮食记录已保存' : 'Food log saved successfully',
      });
    } catch (err: any) {
      toast({
        title: language === 'zh' ? '保存失败' : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (mealType: MealType) => {
    if (!user) return;
    const entry = entries[mealType];
    if (entry.id) {
      await supabase.from('food_logs').delete().eq('id', entry.id);
    }
    setEntries(prev => ({
      ...prev,
      [mealType]: { meal_type: mealType, description: '', photo_url: null },
    }));
    toast({ title: language === 'zh' ? '已删除' : 'Deleted' });
  };

  const hasAnyContent = MEAL_TYPES.some(mt => entries[mt].description || entries[mt].photo_url);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-6 md:py-8 flex flex-col items-center justify-center">
          <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            {language === 'zh' ? '登录以使用饮食记录' : 'Sign in to use Food Log'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {language === 'zh' ? '创建账户或登录以记录您的每日饮食' : 'Create an account or sign in to track your daily meals'}
          </p>
          <Link to="/auth">
            <Button>{t('nav.signIn')}</Button>
          </Link>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-4 md:py-8 pb-20 md:pb-8">
        {/* Title */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-lg md:text-2xl font-bold">
            {language === 'zh' ? '饮食记录' : 'Food Log'}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {language === 'zh' ? '记录每天三餐的饮食' : 'Track your daily meals'}
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedDate(prev => subDays(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[140px]">
            <p className="text-sm font-semibold">
              {format(selectedDate, language === 'zh' ? 'yyyy年M月d日' : 'MMMM d, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(selectedDate, language === 'zh' ? 'EEEE' : 'EEEE')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedDate(prev => addDays(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Meal Cards */}
        <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
          {MEAL_TYPES.map((mealType) => {
            const entry = entries[mealType];
            return (
              <Card key={mealType} className="overflow-hidden">
                <CardContent className="p-3 md:p-4">
                  {/* Meal Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{mealIcons[mealType]}</span>
                      <h3 className="text-sm md:text-base font-semibold">{mealLabels[mealType]}</h3>
                    </div>
                    {(entry.description || entry.photo_url) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteEntry(mealType)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Description Input */}
                  <Input
                    placeholder={language === 'zh' ? `今天${mealLabels[mealType]}吃了什么？` : `What did you have for ${mealLabels[mealType].toLowerCase()}?`}
                    value={entry.description}
                    onChange={(e) => handleDescriptionChange(mealType, e.target.value)}
                    onBlur={() => {
                      if (entry.description) saveEntry(mealType, entry.description, entry.photo_url);
                    }}
                    className="mb-3 text-sm"
                  />

                  {/* Photo Section */}
                  <div className="flex items-start gap-3">
                    {entry.photo_url ? (
                      <div className="relative group">
                        <img
                          src={entry.photo_url}
                          alt={mealLabels[mealType]}
                          className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover border border-border"
                        />
                        <button
                          onClick={() => {
                            setEntries(prev => ({
                              ...prev,
                              [mealType]: { ...prev[mealType], photo_url: null },
                            }));
                            saveEntry(mealType, entry.description, null);
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}

                    <label className="cursor-pointer">
                      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors ${uploading === mealType ? 'opacity-50' : ''}`}>
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {uploading === mealType
                            ? (language === 'zh' ? '上传中...' : 'Uploading...')
                            : (language === 'zh' ? '添加照片' : 'Add Photo')
                          }
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading === mealType}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(mealType, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Save Button */}
        {hasAnyContent && (
          <div className="max-w-2xl mx-auto mt-4">
            <Button onClick={handleSaveAll} disabled={saving} className="w-full">
              {saving
                ? (language === 'zh' ? '保存中...' : 'Saving...')
                : (language === 'zh' ? '保存记录' : 'Save Log')
              }
            </Button>
          </div>
        )}
      </main>
      <MobileBottomNav />
    </div>
  );
}
