import { useState, useMemo, useCallback } from 'react';
import MealPlanChatBox from '@/components/chat/MealPlanChatBox';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trash2, Flame, Clock, Sparkles, Save, Check, RefreshCw, RotateCcw, Calendar, Search, GripVertical } from 'lucide-react';
import { DndContext, DragOverlay, useDroppable, useDraggable, type DragEndEvent, type DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RecipeSource, SupabaseRecipe, DAYS_OF_WEEK, getLocalizedRecipe } from '@/types/recipe';
import { useToast } from '@/hooks/use-toast';
import { useMealPlan } from '@/contexts/MealPlanContext';
import { useMealPlanGenerator } from '@/hooks/useMealPlanGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const MEAL_TYPES: ('lunch' | 'dinner')[] = ['lunch', 'dinner'];

// ---------------------------------------------------------------------------
// RecipeCardContent – pure visual, no dnd hooks (safe to render anywhere)
// ---------------------------------------------------------------------------
function RecipeCardContent({ recipe, language, showRemove, onRemove, recipePath }: {
  recipe: SupabaseRecipe;
  language: string;
  showRemove: boolean;
  onRemove: () => void;
  recipePath?: string;
}) {
  const nameLabel = getLocalizedRecipe(recipe, language).name;

  return (
    <>
      {recipePath ? (
        <Link
          to={recipePath}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="block mb-1"
        >
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={nameLabel}
              draggable={false}
              className="w-full h-12 object-cover rounded mb-1"
            />
          )}
          <p className="font-medium line-clamp-1 hover:underline">{nameLabel}</p>
        </Link>
      ) : (
        <>
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={nameLabel}
              draggable={false}
              className="w-full h-12 object-cover rounded mb-1"
            />
          )}
          <p className="font-medium line-clamp-1">{nameLabel}</p>
        </>
      )}
      <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
        {recipe.calories && (
          <span className="flex items-center gap-0.5">
            <Flame className="h-3 w-3" />
            {recipe.calories}
          </span>
        )}
        {(recipe.prep_time || recipe.cook_time) && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {(recipe.prep_time || 0) + (recipe.cook_time || 0)}m
          </span>
        )}
      </div>
      {showRemove && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DraggableRecipeCard – attaches dnd-kit drag + drop to the wrapper div
// ---------------------------------------------------------------------------
function DraggableRecipeCard({
  id, slotId, recipe, isFinalized, language, onRemove,
}: {
  id: string;
  slotId: string;
  recipe: SupabaseRecipe;
  isFinalized: boolean;
  language: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } =
    useDraggable({ id, disabled: isFinalized });
  const { setNodeRef: setDropRef, isOver } =
    useDroppable({ id: slotId, disabled: isFinalized });

  const setRef = useCallback((node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);

  return (
    <div
      ref={setRef}
      {...attributes}
      className={cn(
        "group relative bg-muted rounded-lg p-2 text-xs",
        isDragging && "opacity-30",
        isOver && "ring-2 ring-primary",
      )}
    >
      {/* Drag handle – only this element carries the dnd-kit listeners */}
      {!isFinalized && (
        <div
          {...listeners}
          className="absolute top-1 left-1 z-10 p-0.5 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 transition-opacity"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
      <RecipeCardContent
        recipe={recipe}
        language={language}
        showRemove={!isFinalized}
        onRemove={onRemove}
        recipePath={`/recipe/${recipe.id}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DroppableSlot – empty slot drop target
// ---------------------------------------------------------------------------
function DroppableSlot({ id, isFinalized, label, onClick }: {
  id: string;
  isFinalized: boolean;
  label: string;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: isFinalized });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors",
        isFinalized && "opacity-50 cursor-not-allowed",
        isOver && !isFinalized && "border-primary bg-primary/10"
      )}
      onClick={() => !isFinalized && onClick()}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MealPlanner page
// ---------------------------------------------------------------------------
export default function MealPlanner() {
  const {
    currentWeekStart,
    mealSlots,
    isFinalized,
    isLoading,
    setCurrentWeekStart,
    setMealSlots,
    addDishToMeal,
    removeDish,
    saveMealPlan,
    finalizeMealPlan,
    resetMealPlan,
    clearMealPlan,
    swapRecipesBetweenSlots,
  } = useMealPlan();

  const { generateMealPlan, fetchRecipesBySource, isGenerating } = useMealPlanGenerator();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const [recipeSource, setRecipeSource] = useState<RecipeSource>('all');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showRecipePickerDialog, setShowRecipePickerDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ dayOfWeek: number; mealType: 'lunch' | 'dinner' } | null>(null);
  const [availableRecipes, setAvailableRecipes] = useState<SupabaseRecipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [numberOfPersons, setNumberOfPersons] = useState(2);

  // Recipe picker filters
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCuisine, setPickerCuisine] = useState('');
  const [pickerPrepTime, setPickerPrepTime] = useState('');

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Require 5 px of movement before a drag starts; prevents interfering with clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const goToPreviousWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const goToNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const goToTomorrow = () => setCurrentWeekStart(addDays(new Date(), 1));

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentWeekStart(startOfDay(date));
      setShowDatePicker(false);
    }
  };

  const getMealsForSlot = (dayOfWeek: number, mealType: 'lunch' | 'dinner') => {
    return mealSlots.filter(s => s.dayOfWeek === dayOfWeek && s.mealType === mealType);
  };

  const handleGenerateMealPlan = async () => {
    const slots = await generateMealPlan(
      recipeSource,
      {
        allergies: userProfile?.allergies,
        dietPreferences: userProfile?.diet_preferences,
        flavorPreferences: userProfile?.flavor_preferences,
      },
      numberOfPersons
    );

    if (slots.length > 0) {
      setMealSlots(slots);
    }
    setShowGenerateDialog(false);
  };

  const handleRegenerate = async () => {
    await resetMealPlan();
  };

  const handleOpenRecipePicker = async (dayOfWeek: number, mealType: 'lunch' | 'dinner') => {
    setSelectedSlot({ dayOfWeek, mealType });
    setRecipesLoading(true);
    setShowRecipePickerDialog(true);
    setPickerSearch('');
    setPickerCuisine('');
    setPickerPrepTime('');

    const recipes = await fetchRecipesBySource(recipeSource);
    setAvailableRecipes(recipes);
    setRecipesLoading(false);
  };

  const handleSelectRecipe = (recipe: SupabaseRecipe) => {
    if (selectedSlot) {
      addDishToMeal(selectedSlot.dayOfWeek, selectedSlot.mealType, recipe);
    }
    setShowRecipePickerDialog(false);
    setSelectedSlot(null);
  };

  const handleRemoveDish = (dayOfWeek: number, mealType: 'lunch' | 'dinner', recipeId: number) => {
    removeDish(dayOfWeek, mealType, recipeId);
    toast({
      title: t('mealPlan.mealRemoved'),
      description: t('mealPlan.mealRemovedDesc'),
    });
  };

  const totalCaloriesForDay = (dayOfWeek: number) => {
    const dayMeals = mealSlots.filter(s => s.dayOfWeek === dayOfWeek && s.recipe);
    return dayMeals.reduce((sum, meal) => sum + (meal.recipe?.calories || 0), 0);
  };

  const uniqueCuisines = useMemo(() => {
    const cuisines = new Set<string>();
    availableRecipes.forEach(r => {
      if (r.cuisine) cuisines.add(r.cuisine);
    });
    return Array.from(cuisines).sort();
  }, [availableRecipes]);

  const filteredRecipes = useMemo(() => {
    return availableRecipes.filter(recipe => {
      if (pickerSearch) {
        const searchLower = pickerSearch.toLowerCase();
        const name = (recipe.name || '').toLowerCase();
        const englishName = (recipe.english_name || '').toLowerCase();
        if (!name.includes(searchLower) && !englishName.includes(searchLower)) {
          return false;
        }
      }

      if (pickerCuisine && recipe.cuisine !== pickerCuisine) {
        return false;
      }

      if (pickerPrepTime) {
        const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
        switch (pickerPrepTime) {
          case 'under15': if (totalTime > 15) return false; break;
          case 'under30': if (totalTime > 30) return false; break;
          case 'under60': if (totalTime > 60) return false; break;
          case 'over60': if (totalTime <= 60) return false; break;
        }
      }

      return true;
    });
  }, [availableRecipes, pickerSearch, pickerCuisine, pickerPrepTime]);

  const totalMealsPlanned = mealSlots.filter(s => s.recipe).length;

  const totalCalories = mealSlots.reduce((sum, m) => sum + (m.recipe?.calories || 0), 0);
  const totalPrepTime = mealSlots.reduce((sum, m) => sum + ((m.recipe?.prep_time || 0) + (m.recipe?.cook_time || 0)), 0);
  const avgCalories = totalMealsPlanned > 0 ? Math.round(totalCalories / totalMealsPlanned) : 0;
  const avgPrepTime = totalMealsPlanned > 0 ? Math.round(totalPrepTime / totalMealsPlanned) : 0;

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    // active.id: "recipe::dayOfWeek::mealType::recipeId"
    // over.id:   "slot::dayOfWeek::mealType"
    const activeParts = (active.id as string).split('::');
    const overParts = (over.id as string).split('::');

    if (activeParts[0] !== 'recipe') return;
    if (overParts[0] !== 'slot') return;

    const fromDay = Number(activeParts[1]);
    const fromType = activeParts[2] as 'lunch' | 'dinner';
    const recipeId = Number(activeParts[3]);
    const toDay = Number(overParts[1]);
    const toType = overParts[2] as 'lunch' | 'dinner';

    if (fromDay === toDay && fromType === toType) return;

    swapRecipesBetweenSlots(fromDay, fromType, recipeId, toDay, toType);
  }

  // Find the active dragged recipe for the overlay
  const activeDragMeal = useMemo(() => {
    if (!activeDragId) return null;
    const parts = activeDragId.split('::');
    if (parts[0] !== 'recipe') return null;
    const fromDay = Number(parts[1]);
    const fromType = parts[2];
    const recipeId = Number(parts[3]);
    return mealSlots.find(s =>
      s.dayOfWeek === fromDay &&
      s.mealType === fromType &&
      s.recipe?.id === recipeId
    ) ?? null;
  }, [activeDragId, mealSlots]);

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
              {t('mealPlanner.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('mealPlanner.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* AI Generate Button */}
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={isGenerating || isFinalized}>
                  <Sparkles className="h-4 w-4" />
                  {t('mealPlanner.aiGenerate')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('mealPlanner.generateTitle')}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('mealPlanner.generateDesc')}
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      {t('mealPlanner.numberOfPersons')}
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setNumberOfPersons(Math.max(1, numberOfPersons - 1))}
                        disabled={numberOfPersons <= 1}
                      >
                        -
                      </Button>
                      <span className="text-2xl font-bold w-8 text-center">{numberOfPersons}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setNumberOfPersons(Math.min(6, numberOfPersons + 1))}
                        disabled={numberOfPersons >= 6}
                      >
                        +
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('mealPlanner.personsDesc')}</p>
                  </div>

                  {user && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('mealPlanner.recipeSource')}</label>
                      <Select value={recipeSource} onValueChange={(v) => setRecipeSource(v as RecipeSource)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('mealPlanner.recipeSource')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('mealPlanner.allRecipes')}</SelectItem>
                          <SelectItem value="saved">{t('mealPlanner.savedRecipes')}</SelectItem>
                          <SelectItem value="my-recipes">{t('mealPlanner.myRecipes')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {userProfile && (
                    <div className="text-sm text-muted-foreground">
                      <p>Your preferences will be considered:</p>
                      <ul className="list-disc list-inside mt-1">
                        {userProfile.allergies?.length > 0 && (
                          <li>Allergies: {userProfile.allergies.join(', ')}</li>
                        )}
                        {userProfile.diet_preferences?.length > 0 && (
                          <li>Diet: {userProfile.diet_preferences.join(', ')}</li>
                        )}
                        {userProfile.flavor_preferences?.length > 0 && (
                          <li>Flavors: {userProfile.flavor_preferences.join(', ')}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                    {t('mealPlanner.cancel')}
                  </Button>
                  <Button onClick={handleGenerateMealPlan} disabled={isGenerating} className="gap-2">
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t('mealPlanner.generating')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {t('mealPlanner.generate')}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {isFinalized && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleRegenerate}
                disabled={isLoading}
              >
                <RotateCcw className="h-4 w-4" />
                {t('mealPlanner.regenerate')}
              </Button>
            )}

            <Button
              variant="outline"
              className="gap-2"
              onClick={saveMealPlan}
              disabled={isLoading || mealSlots.length === 0}
            >
              <Save className="h-4 w-4" />
              {t('mealPlanner.save')}
            </Button>

            <Button
              variant={isFinalized ? "secondary" : "default"}
              className="gap-2"
              onClick={finalizeMealPlan}
              disabled={isLoading || mealSlots.length === 0 || isFinalized}
            >
              <Check className="h-4 w-4" />
              {isFinalized ? t('mealPlanner.finalized') : t('mealPlanner.finalize')}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={clearMealPlan}
              disabled={isLoading || mealSlots.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                {t('mealPlanner.selectStartDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarComponent
                mode="single"
                selected={currentWeekStart}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" onClick={goToTomorrow}>
            {t('mealPlanner.startTomorrow')}
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week Header */}
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {format(currentWeekStart, 'MMMM d')} - {format(addDays(currentWeekStart, 6), 'MMMM d, yyyy')}
          </h2>
          {isFinalized && (
            <Badge variant="secondary" className="mt-2">
              <Check className="h-3 w-3 mr-1" />
              {t('mealPlanner.finalizedBadge')}
            </Badge>
          )}
        </div>

        {/* Calendar Grid */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          collisionDetection={closestCenter}
        >
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDays.map((day, dayIndex) => {
              const isToday = isSameDay(day, new Date());
              const dayCalories = totalCaloriesForDay(dayIndex);

              return (
                <Card
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[280px] transition-all",
                    isToday && "ring-2 ring-primary"
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-col items-center">
                      <span className="text-xs uppercase text-muted-foreground">
                        {format(day, 'EEE')}
                      </span>
                      <span className={cn(
                        "text-2xl font-display",
                        isToday && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayCalories > 0 && (
                        <Badge variant="outline" className="mt-1 gap-1 text-xs">
                          <Flame className="h-3 w-3" />
                          {dayCalories} cal
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {MEAL_TYPES.map((mealType) => {
                      const meals = getMealsForSlot(dayIndex, mealType);
                      const mealLabel = mealType === 'lunch' ? t('mealPlanner.lunch') : t('mealPlanner.dinner');
                      const addLabel = mealType === 'lunch' ? t('mealPlanner.addLunch') : t('mealPlanner.addDinner');

                      return (
                        <div key={mealType} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              {mealLabel} {meals.length > 0 && `(${meals.length})`}
                            </span>
                            {!isFinalized && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => handleOpenRecipePicker(dayIndex, mealType)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>

                          {meals.length > 0 ? (
                            <div className="space-y-1">
                              {meals.map((meal, idx) => meal.recipe && (
                                <DraggableRecipeCard
                                  key={`${meal.recipe.id}-${idx}`}
                                  id={`recipe::${dayIndex}::${mealType}::${meal.recipe.id}`}
                                  slotId={`slot::${dayIndex}::${mealType}`}
                                  recipe={meal.recipe}
                                  isFinalized={isFinalized}
                                  language={language}
                                  onRemove={() => handleRemoveDish(dayIndex, mealType, meal.recipe!.id)}
                                />
                              ))}
                            </div>
                          ) : (
                            <DroppableSlot
                              id={`slot::${dayIndex}::${mealType}`}
                              isFinalized={isFinalized}
                              label={addLabel}
                              onClick={() => handleOpenRecipePicker(dayIndex, mealType)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DragOverlay>
            {activeDragId && activeDragMeal?.recipe ? (
              <div className="group relative bg-muted rounded-lg p-2 text-xs shadow-lg rotate-1 opacity-95 cursor-grabbing w-32">
                <RecipeCardContent
                  recipe={activeDragMeal.recipe}
                  language={language}
                  showRemove={false}
                  onRemove={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Weekly Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="font-display">{t('mealPlanner.weeklySummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-primary">{totalMealsPlanned}</p>
                <p className="text-sm text-muted-foreground">{t('mealPlanner.mealsPlanned')}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-spice">
                  {avgCalories}
                </p>
                <p className="text-sm text-muted-foreground">{t('mealPlanner.avgCalories')}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-herb">
                  {mealSlots.reduce((sum, m) => sum + (m.recipe?.ingredients?.length || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">{t('mealPlanner.ingredients')}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-accent">
                  {avgPrepTime}
                </p>
                <p className="text-sm text-muted-foreground">{t('mealPlanner.avgPrepTime')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recipe Picker Dialog */}
        <Dialog open={showRecipePickerDialog} onOpenChange={setShowRecipePickerDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {t('mealPlanner.selectRecipe')} {selectedSlot && DAYS_OF_WEEK[selectedSlot.dayOfWeek]} {selectedSlot?.mealType === 'lunch' ? t('mealPlanner.lunch') : t('mealPlanner.dinner')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('mealPlanner.searchRecipes')}
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Select value={pickerCuisine || 'all'} onValueChange={(v) => setPickerCuisine(v === 'all' ? '' : v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('mealPlanner.filterByCuisine')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('mealPlanner.filterByCuisine')}</SelectItem>
                    {uniqueCuisines.map((cuisine) => (
                      <SelectItem key={cuisine} value={cuisine}>{cuisine}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={pickerPrepTime || 'all'} onValueChange={(v) => setPickerPrepTime(v === 'all' ? '' : v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('mealPlanner.filterByTime')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('mealPlanner.filterByTime')}</SelectItem>
                    <SelectItem value="under15">{t('mealPlanner.under15min')}</SelectItem>
                    <SelectItem value="under30">{t('mealPlanner.under30min')}</SelectItem>
                    <SelectItem value="under60">{t('mealPlanner.under60min')}</SelectItem>
                    <SelectItem value="over60">{t('mealPlanner.over60min')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!recipesLoading && availableRecipes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {filteredRecipes.length} {language === 'zh' ? '个结果' : 'results'}
                </p>
              )}

              <div className="max-h-[50vh] overflow-y-auto pr-2">
                {recipesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRecipes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>{t('mealPlanner.noRecipesFound')}</p>
                    <p className="text-sm mt-2">{t('mealPlanner.tryDifferentSource')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {filteredRecipes.map((recipe) => (
                      <Card
                        key={recipe.id}
                        className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => handleSelectRecipe(recipe)}
                      >
                        <CardContent className="p-3">
                          {recipe.image_url && (
                            <img
                              src={recipe.image_url}
                              alt={recipe.name}
                              className="w-full h-24 object-cover rounded mb-2"
                            />
                          )}
                          <p className="font-medium text-sm line-clamp-2">{getLocalizedRecipe(recipe, language).name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {recipe.cuisine && (
                              <Badge variant="outline" className="text-xs">{recipe.cuisine}</Badge>
                            )}
                            {recipe.calories && (
                              <span className="flex items-center gap-0.5">
                                <Flame className="h-3 w-3" />
                                {recipe.calories}
                              </span>
                            )}
                            {(recipe.prep_time || recipe.cook_time) && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {(recipe.prep_time || 0) + (recipe.cook_time || 0)}m
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <MealPlanChatBox />
    </Layout>
  );
}
