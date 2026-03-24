import { useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Camera, Plus, X, UtensilsCrossed, Trash2, ChevronDown, CalendarDays } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface FoodLogItem {
  id?: string;
  tempId: string;
  meal_type: MealType;
  description: string;
  photo_url: string | null;
  sort_order: number;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

const createEmptyItem = (mealType: MealType, sortOrder = 0): FoodLogItem => ({
  tempId: crypto.randomUUID(),
  meal_type: mealType,
  description: '',
  photo_url: null,
  sort_order: sortOrder,
});

const buildEmptyEntries = (): Record<MealType, FoodLogItem[]> => ({
  breakfast: [],
  lunch: [],
  dinner: [],
});

const buildEntriesFromRows = (rows: any[] = []): Record<MealType, FoodLogItem[]> => {
  const grouped: Record<MealType, FoodLogItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
  };

  rows.forEach((row) => {
    const mealType = row.meal_type as MealType;
    if (!MEAL_TYPES.includes(mealType)) return;

    grouped[mealType].push({
      id: row.id,
      tempId: row.id ?? crypto.randomUUID(),
      meal_type: mealType,
      description: row.description ?? '',
      photo_url: row.photo_url ?? null,
      sort_order: row.sort_order ?? 0,
    });
  });

  MEAL_TYPES.forEach((mealType) => {
    grouped[mealType].sort((a, b) => a.sort_order - b.sort_order);
  });

  return grouped;
};

function MonthCalendarView({
  calendarMonth,
  selectedDate,
  monthDishes,
  language,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  calendarMonth: Date;
  selectedDate: Date;
  monthDishes: Record<string, string[]>;
  language: string;
  onSelectDate: (d: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0=Sun

  const weekLabels = language === 'zh'
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card className="max-w-2xl mx-auto mb-4 overflow-hidden">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold">
            {format(calendarMonth, language === 'zh' ? 'yyyy年M月' : 'MMMM yyyy')}
          </p>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {weekLabels.map((l) => (
            <div key={l} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {l}
            </div>
          ))}

          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dishes = monthDishes[key] ?? [];
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={key}
                onClick={() => onSelectDate(day)}
                className={cn(
                  'flex flex-col items-start p-1 rounded-lg text-left min-h-[60px] md:min-h-[80px] transition-colors hover:bg-accent/50 border border-transparent',
                  isSelected && 'border-primary bg-primary/5',
                  isToday && !isSelected && 'bg-accent/30'
                )}
              >
                <span className={cn(
                  'text-[11px] font-medium mb-0.5',
                  isSelected && 'text-primary',
                  !isSameMonth(day, calendarMonth) && 'text-muted-foreground/40'
                )}>
                  {format(day, 'd')}
                </span>
                {dishes.length > 0 && (
                  <div className="w-full space-y-0">
                    {dishes.slice(0, 3).map((name, i) => (
                      <p key={i} className="text-[9px] md:text-[10px] text-foreground/70 leading-tight truncate w-full">
                        {name}
                      </p>
                    ))}
                    {dishes.length > 3 && (
                      <p className="text-[9px] text-muted-foreground">+{dishes.length - 3}</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FoodLog() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<Record<MealType, FoodLogItem[]>>(buildEmptyEntries);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [monthDishes, setMonthDishes] = useState<Record<string, string[]>>({});
  const [expandedMeals, setExpandedMeals] = useState<Record<MealType, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
  });

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

  // Determine if a meal has saved content
  const mealHasContent = (mealType: MealType) =>
    entries[mealType].some((item) => item.id || item.description || item.photo_url);

  const isMealExpanded = (mealType: MealType) =>
    expandedMeals[mealType] || mealHasContent(mealType);

  const toggleMealExpanded = (mealType: MealType) => {
    if (mealHasContent(mealType)) return; // always expanded if has content
    setExpandedMeals((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  };

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    const foodLogsTable = supabase.from('food_logs') as any;
    const { data, error } = await foodLogsTable
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', dateStr)
      .order('meal_type', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching food logs:', error);
      return;
    }

    const built = buildEntriesFromRows(data ?? []);
    setEntries(built);
    // Reset expanded state for empty meals
    setExpandedMeals({ breakfast: false, lunch: false, dinner: false });
  }, [user, dateStr]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Fetch all dishes for the calendar month view
  const fetchMonthDishes = useCallback(async () => {
    if (!user || !showCalendar) return;
    const monthStart = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');
    const foodLogsTable = supabase.from('food_logs') as any;
    const { data, error } = await foodLogsTable
      .select('log_date, description')
      .eq('user_id', user.id)
      .gte('log_date', monthStart)
      .lte('log_date', monthEnd)
      .not('description', 'is', null)
      .order('log_date', { ascending: true });

    if (error) { console.error(error); return; }

    const grouped: Record<string, string[]> = {};
    (data ?? []).forEach((row: any) => {
      const d = row.log_date as string;
      if (!row.description) return;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(row.description);
    });
    setMonthDishes(grouped);
  }, [user, showCalendar, calendarMonth]);

  useEffect(() => {
    fetchMonthDishes();
  }, [fetchMonthDishes]);

  const updateLocalItem = (mealType: MealType, tempId: string, updates: Partial<FoodLogItem>) => {
    setEntries((prev) => ({
      ...prev,
      [mealType]: prev[mealType].map((item) =>
        item.tempId === tempId
          ? { ...item, ...updates }
          : item
      ),
    }));
  };

  const saveDish = async (
    mealType: MealType,
    tempId: string,
    options?: {
      description?: string;
      photoUrl?: string | null;
      forceInsert?: boolean;
    }
  ) => {
    if (!user) return null;

    const item = entries[mealType].find((entry) => entry.tempId === tempId);
    if (!item) return null;

    const description = options?.description ?? item.description;
    const photoUrl = options?.photoUrl ?? item.photo_url;
    const payload = {
      user_id: user.id,
      log_date: dateStr,
      meal_type: mealType,
      description,
      photo_url: photoUrl,
      sort_order: item.sort_order,
    };

    const foodLogsTable = supabase.from('food_logs') as any;

    if (item.id) {
      const { error } = await foodLogsTable
        .update({
          description,
          photo_url: photoUrl,
          sort_order: item.sort_order,
        })
        .eq('id', item.id);

      if (error) {
        console.error('Save error:', error);
      }

      return item.id;
    }

    if (!options?.forceInsert && !description && !photoUrl) {
      return null;
    }

    const { data, error } = await foodLogsTable
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('Create error:', error);
      return null;
    }

    updateLocalItem(mealType, tempId, {
      id: data.id,
      tempId: data.id,
      description: data.description ?? description,
      photo_url: data.photo_url ?? photoUrl,
      sort_order: data.sort_order ?? item.sort_order,
    });

    return data.id as string;
  };

  const handleAddDish = (mealType: MealType) => {
    const nextSortOrder = Math.max(...entries[mealType].map((item) => item.sort_order), -1) + 1;
    setEntries((prev) => ({
      ...prev,
      [mealType]: [...prev[mealType], createEmptyItem(mealType, nextSortOrder)],
    }));
    // Ensure expanded
    setExpandedMeals((prev) => ({ ...prev, [mealType]: true }));
  };

  const handleDescriptionChange = (mealType: MealType, tempId: string, value: string) => {
    updateLocalItem(mealType, tempId, { description: value });
  };

  const handlePhotoUpload = async (mealType: MealType, tempId: string, file: File) => {
    if (!user) return;
    setUploading(tempId);

    try {
      let rowId = entries[mealType].find((item) => item.tempId === tempId)?.id;
      if (!rowId) {
        rowId = await saveDish(mealType, tempId, { forceInsert: true });
      }

      if (!rowId) {
        throw new Error(language === 'zh' ? '无法创建记录' : 'Could not create log entry');
      }

      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${dateStr}/${mealType}/${rowId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('food-log-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('food-log-photos')
        .getPublicUrl(filePath);

      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      updateLocalItem(mealType, tempId, { photo_url: photoUrl, id: rowId, tempId: rowId });
      await saveDish(mealType, rowId, { photoUrl, forceInsert: true });

      toast({ title: language === 'zh' ? '照片已上传' : 'Photo uploaded' });
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

  const handleRemovePhoto = async (mealType: MealType, tempId: string) => {
    const item = entries[mealType].find((entry) => entry.tempId === tempId);
    if (!item) return;

    updateLocalItem(mealType, tempId, { photo_url: null });
    if (item.id) {
      await saveDish(mealType, tempId, { photoUrl: null, forceInsert: true });
    }
  };

  const handleDeleteDish = async (mealType: MealType, tempId: string) => {
    const item = entries[mealType].find((entry) => entry.tempId === tempId);
    if (!item) return;

    if (item.id) {
      await (supabase.from('food_logs') as any).delete().eq('id', item.id);
    }

    setEntries((prev) => {
      const nextItems = prev[mealType].filter((entry) => entry.tempId !== tempId);
      return {
        ...prev,
        [mealType]: nextItems,
      };
    });

    toast({ title: language === 'zh' ? '已删除' : 'Deleted' });
  };

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);

    try {
      for (const mealType of MEAL_TYPES) {
        for (const item of entries[mealType]) {
          if (item.description || item.photo_url) {
            await saveDish(mealType, item.tempId);
          }
        }
      }

      toast({
        title: language === 'zh' ? '已保存' : 'Saved',
        description: language === 'zh' ? '今日饮食记录已保存' : 'Food log saved successfully',
      });
    } catch {
      toast({
        title: language === 'zh' ? '保存失败' : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasAnyContent = MEAL_TYPES.some((mealType) =>
    entries[mealType].some((item) => item.description || item.photo_url)
  );

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
        <div className="mb-4 md:mb-6">
          <h1 className="text-lg md:text-2xl font-bold">
            {language === 'zh' ? '饮食记录' : 'Food Log'}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {language === 'zh' ? '记录每天三餐的多道菜品与照片' : 'Track multiple dishes and photos for each meal'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedDate((prev) => subDays(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            className="text-center min-w-[140px] hover:bg-accent rounded-lg px-3 py-1 transition-colors"
            onClick={() => { setShowCalendar((v) => !v); setCalendarMonth(selectedDate); }}
          >
            <p className="text-sm font-semibold flex items-center justify-center gap-1.5">
              {format(selectedDate, language === 'zh' ? 'yyyy年M月d日' : 'MMMM d, yyyy')}
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            </p>
            <p className="text-xs text-muted-foreground">
              {format(selectedDate, language === 'zh' ? 'EEEE' : 'EEEE', { locale: language === 'zh' ? zhCN : undefined })}
            </p>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedDate((prev) => addDays(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Monthly calendar view */}
        {showCalendar && (
          <MonthCalendarView
            calendarMonth={calendarMonth}
            selectedDate={selectedDate}
            monthDishes={monthDishes}
            language={language}
            onSelectDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
            onPrevMonth={() => setCalendarMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
          />
        )}

        <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
          {MEAL_TYPES.map((mealType) => {
            const expanded = isMealExpanded(mealType);
            const hasContent = mealHasContent(mealType);
            const itemCount = entries[mealType].filter(i => i.id || i.description).length;

            return (
              <Card key={mealType} className="overflow-hidden">
                <CardContent className="p-3 md:p-4">
                  <div
                    className={cn(
                      "flex items-center justify-between",
                      !hasContent && "cursor-pointer"
                    )}
                    onClick={() => !hasContent && toggleMealExpanded(mealType)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{mealIcons[mealType]}</span>
                      <h3 className="text-sm md:text-base font-semibold">{mealLabels[mealType]}</h3>
                      {!expanded && itemCount === 0 && (
                        <span className="text-xs text-muted-foreground">
                          {language === 'zh' ? '点击展开' : 'Tap to expand'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddDish(mealType);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {language === 'zh' ? '添加' : 'Add'}
                      </Button>
                      {!hasContent && (
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          expanded && "rotate-180"
                        )} />
                      )}
                    </div>
                  </div>

                  {expanded && entries[mealType].length > 0 && (
                    <div className="space-y-3 mt-3">
                      {entries[mealType].map((item, index) => (
                        <div
                          key={item.tempId}
                          className={cn(
                            'rounded-xl border border-border bg-card/60 p-3',
                            index > 0 && 'mt-2'
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {language === 'zh' ? `菜品 ${index + 1}` : `Dish ${index + 1}`}
                            </p>
                            {!item.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteDish(mealType, item.tempId)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>

                          <Input
                            placeholder={language === 'zh' ? '输入菜名' : 'Enter dish name'}
                            value={item.description}
                            onChange={(e) => handleDescriptionChange(mealType, item.tempId, e.target.value)}
                            onBlur={() => {
                              if (item.description || item.photo_url) {
                                saveDish(mealType, item.tempId);
                              }
                            }}
                            className="mb-3 text-sm"
                          />

                          <div className="flex flex-wrap items-start gap-3">
                            {item.photo_url ? (
                              <div className="relative group">
                                <img
                                  src={item.photo_url}
                                  alt={item.description || mealLabels[mealType]}
                                  className="h-20 w-20 rounded-lg border border-border object-cover md:h-24 md:w-24"
                                />
                                {!item.id && (
                                  <button
                                    onClick={() => handleRemovePhoto(mealType, item.tempId)}
                                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : null}

                            <label className="cursor-pointer">
                              <div className={cn(
                                'flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 transition-colors hover:border-primary hover:bg-primary/5',
                                uploading === item.tempId && 'opacity-50'
                              )}>
                                <Camera className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {uploading === item.tempId
                                    ? (language === 'zh' ? '上传中...' : 'Uploading...')
                                    : (language === 'zh' ? '添加照片' : 'Add Photo')}
                                </span>
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploading === item.tempId}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoUpload(mealType, item.tempId, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {hasAnyContent && (
          <div className="max-w-2xl mx-auto mt-4">
            <Button onClick={handleSaveAll} disabled={saving} className="w-full">
              {saving
                ? (language === 'zh' ? '保存中...' : 'Saving...')
                : (language === 'zh' ? '保存记录' : 'Save Log')}
            </Button>
          </div>
        )}
      </main>
      <MobileBottomNav />
    </div>
  );
}