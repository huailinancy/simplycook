import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { MealSlot, SupabaseRecipe, GroceryItem, getLocalizedRecipe } from '@/types/recipe';
import { format, addDays } from 'date-fns';

interface MealPlanContextType {
  currentWeekStart: Date;
  mealSlots: MealSlot[];
  isFinalized: boolean;
  isLoading: boolean;
  mealPlanId: string | null;
  setCurrentWeekStart: (date: Date) => void;
  setMealSlots: (slots: MealSlot[]) => void;
  addMealSlot: (slot: MealSlot) => void;
  addDishToMeal: (dayOfWeek: number, mealType: 'lunch' | 'dinner', recipe: SupabaseRecipe) => void;
  removeDish: (dayOfWeek: number, mealType: 'lunch' | 'dinner', recipeId: number) => void;
  removeMealSlot: (dayOfWeek: number, mealType: 'lunch' | 'dinner') => void;
  updateMealSlot: (dayOfWeek: number, mealType: 'lunch' | 'dinner', recipe: SupabaseRecipe | null) => void;
  saveMealPlan: () => Promise<void>;
  loadMealPlan: () => Promise<void>;
  finalizeMealPlan: () => Promise<void>;
  resetMealPlan: () => Promise<void>;
  clearMealPlan: () => void;
  generateGroceryList: () => Promise<GroceryItem[]>;
}

const MealPlanContext = createContext<MealPlanContextType | undefined>(undefined);

export function MealPlanProvider({ children }: { children: ReactNode }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => addDays(new Date(), 1));
  const [mealSlots, setMealSlots] = useState<MealSlot[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mealPlanId, setMealPlanId] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { language, t } = useLanguage();

  const [prevUser, setPrevUser] = useState(user);

  useEffect(() => {
    if (user) {
      loadMealPlan();
    } else if (prevUser && !user) {
      setMealSlots([]);
      setIsFinalized(false);
      setMealPlanId(null);
    }
    setPrevUser(user);
  }, [user, currentWeekStart]);

  const loadMealPlan = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .single();

      if (planError) {
        if (planError.code === 'PGRST116') {
          setMealSlots([]);
          setIsFinalized(false);
          setMealPlanId(null);
          return;
        }
        throw planError;
      }

      setMealPlanId(planData.id);
      setIsFinalized(planData.is_finalized || false);

      const { data: itemsData, error: itemsError } = await supabase
        .from('meal_plan_items')
        .select(`id, day_of_week, meal_type, recipe_id, recipes (*)`)
        .eq('meal_plan_id', planData.id);

      if (itemsError) throw itemsError;

      const slots: MealSlot[] = (itemsData || []).map((item: any) => ({
        id: item.id,
        dayOfWeek: item.day_of_week,
        mealType: item.meal_type as 'lunch' | 'dinner',
        recipe: item.recipes as SupabaseRecipe,
      }));

      setMealSlots(slots);
    } catch (error) {
      console.error('Error loading meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentWeekStart]);

  const saveMealPlan = useCallback(async () => {
    if (!user) {
      toast({ title: t('mealPlan.savedLocal'), description: t('mealPlan.savedLocalDesc') });
      return;
    }

    setIsLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: user.id,
          week_start: weekStartStr,
          is_finalized: isFinalized,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,week_start' })
        .select()
        .single();

      if (planError) throw planError;

      const planId = planData.id;
      setMealPlanId(planId);

      await supabase.from('meal_plan_items').delete().eq('meal_plan_id', planId);

      if (mealSlots.length > 0) {
        const items = mealSlots
          .filter(slot => slot.recipe)
          .map(slot => ({
            meal_plan_id: planId,
            recipe_id: slot.recipe!.id,
            day_of_week: slot.dayOfWeek,
            meal_type: slot.mealType,
          }));

        if (items.length > 0) {
          await supabase.from('meal_plan_items').insert(items);
        }
      }

      toast({ title: t('mealPlan.saved'), description: t('mealPlan.savedDesc') });
    } catch (error) {
      console.error('Error saving meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentWeekStart, mealSlots, isFinalized, toast, t]);

  const finalizeMealPlan = useCallback(async () => {
    if (mealSlots.length === 0) {
      toast({ title: t('mealPlan.noMeals'), description: t('mealPlan.noMealsDesc'), variant: 'destructive' });
      return;
    }

    if (!user) {
      setIsFinalized(true);
      toast({ title: t('mealPlan.finalized'), description: t('mealPlan.finalizedLocal') });
      return;
    }

    setIsLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: user.id,
          week_start: weekStartStr,
          is_finalized: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,week_start' })
        .select()
        .single();

      if (planError) throw planError;

      const planId = planData.id;
      setMealPlanId(planId);

      await supabase.from('meal_plan_items').delete().eq('meal_plan_id', planId);

      const items = mealSlots
        .filter(slot => slot.recipe)
        .map(slot => ({
          meal_plan_id: planId,
          recipe_id: slot.recipe!.id,
          day_of_week: slot.dayOfWeek,
          meal_type: slot.mealType,
        }));

      if (items.length > 0) {
        await supabase.from('meal_plan_items').insert(items);
      }

      setIsFinalized(true);
      toast({ title: t('mealPlan.finalized'), description: t('mealPlan.finalizedDesc') });
    } catch (error: any) {
      console.error('Error finalizing meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentWeekStart, mealSlots, toast, t]);

  const addDishToMeal = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner', recipe: SupabaseRecipe) => {
    setMealSlots(prev => [...prev, { dayOfWeek, mealType, recipe }]);
  }, []);

  const removeDish = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner', recipeId: number) => {
    setMealSlots(prev => {
      const index = prev.findIndex(s => s.dayOfWeek === dayOfWeek && s.mealType === mealType && s.recipe?.id === recipeId);
      if (index === -1) return prev;
      return [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  }, []);

  const addMealSlot = useCallback((slot: MealSlot) => {
    setMealSlots(prev => {
      const filtered = prev.filter(s => !(s.dayOfWeek === slot.dayOfWeek && s.mealType === slot.mealType));
      return [...filtered, slot];
    });
  }, []);

  const removeMealSlot = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner') => {
    setMealSlots(prev => prev.filter(s => !(s.dayOfWeek === dayOfWeek && s.mealType === mealType)));
  }, []);

  const updateMealSlot = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner', recipe: SupabaseRecipe | null) => {
    if (recipe) addMealSlot({ dayOfWeek, mealType, recipe });
    else removeMealSlot(dayOfWeek, mealType);
  }, [addMealSlot, removeMealSlot]);

  const clearMealPlan = useCallback(() => {
    setMealSlots([]);
    setIsFinalized(false);
  }, []);

  const resetMealPlan = useCallback(async () => {
    if (!user) {
      setMealSlots([]);
      setIsFinalized(false);
      toast({ title: t('mealPlan.reset'), description: t('mealPlan.resetDesc') });
      return;
    }

    setIsLoading(true);
    try {
      if (mealPlanId) {
        await supabase.from('meal_plans').update({ is_finalized: false, updated_at: new Date().toISOString() }).eq('id', mealPlanId);
      }
      setMealSlots([]);
      setIsFinalized(false);
      toast({ title: t('mealPlan.reset'), description: t('mealPlan.resetDesc') });
    } catch (error) {
      console.error('Error resetting meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, mealPlanId, toast, t]);

  // Generate grocery list from recipe ingredients (no AI needed)
  const generateGroceryList = useCallback(async (): Promise<GroceryItem[]> => {
    if (!isFinalized) {
      toast({ title: 'Finalize your meal plan first', description: 'Please finalize your meal plan before generating a grocery list', variant: 'destructive' });
      return [];
    }

    if (mealSlots.length === 0) {
      toast({ title: 'No meals in plan', description: 'Your meal plan is empty. Add some meals first.', variant: 'destructive' });
      return [];
    }

    const ingredientMap = new Map<string, { quantity: number; unit: string; category: string }>();

    for (const slot of mealSlots) {
      if (!slot.recipe) continue;

      const localizedRecipe = getLocalizedRecipe(slot.recipe, language);
      const ingredients = localizedRecipe.ingredients;

      if (!ingredients || ingredients.length === 0) continue;

      for (const ingredient of ingredients) {
        if (!ingredient.name) continue;

        const key = ingredient.name.toLowerCase().trim();
        const existing = ingredientMap.get(key);

        let qty: number;
        let unit: string;

        if (typeof (ingredient as any).quantity === 'number') {
          qty = (ingredient as any).quantity || 1;
          unit = (ingredient as any).unit || (language === 'en' ? 'item' : '个');
        } else if (ingredient.amount) {
          const numMatch = ingredient.amount.match(/[\d.]+/);
          qty = numMatch ? parseFloat(numMatch[0]) : 1;
          unit = ingredient.amount.replace(/[\d.]/g, '').trim() || (language === 'en' ? 'item' : '个');
        } else {
          qty = 1;
          unit = language === 'en' ? 'item' : '个';
        }

        if (existing) {
          if (existing.unit === unit) existing.quantity += qty;
          else existing.quantity += 1;
        } else {
          ingredientMap.set(key, { quantity: qty, unit, category: categorizeIngredient(ingredient.name) });
        }
      }
    }

    if (ingredientMap.size === 0) {
      toast({ title: t('groceryList.noIngredientsFound'), description: t('groceryList.noIngredientsDesc'), variant: 'destructive' });
      return [];
    }

    const groceryList: GroceryItem[] = Array.from(ingredientMap.entries()).map(([name, data], index) => ({
      id: `gen-${index}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      quantity: Math.ceil(data.quantity),
      unit: data.unit,
      category: data.category,
      checked: false,
    }));

    toast({ title: t('groceryList.generated'), description: `${groceryList.length} ${t('groceryList.generatedDesc')}` });
    return groceryList;
  }, [isFinalized, mealSlots, toast, language, t]);

  return (
    <MealPlanContext.Provider value={{
      currentWeekStart, mealSlots, isFinalized, isLoading, mealPlanId,
      setCurrentWeekStart, setMealSlots, addMealSlot, addDishToMeal, removeDish,
      removeMealSlot, updateMealSlot, saveMealPlan, loadMealPlan, finalizeMealPlan,
      resetMealPlan, clearMealPlan, generateGroceryList,
    }}>
      {children}
    </MealPlanContext.Provider>
  );
}

export function useMealPlan() {
  const context = useContext(MealPlanContext);
  if (context === undefined) throw new Error('useMealPlan must be used within a MealPlanProvider');
  return context;
}

function categorizeIngredient(name: string): string {
  const n = name.toLowerCase();
  if (/vegetable|tomato|onion|garlic|pepper|carrot|cucumber|broccoli|spinach|cabbage|mushroom|potato|eggplant|ginger|scallion|茄子|番茄|洋葱|葱|蒜|辣椒|胡萝卜|黄瓜|菠菜|白菜|蘑菇|土豆|姜|青菜|菜|瓜|豆腐/.test(n)) return 'Produce';
  if (/chicken|beef|pork|lamb|fish|shrimp|meat|duck|seafood|鸡|牛|猪|羊|鱼|虾|肉|鸭|排骨|海鲜/.test(n)) return 'Meat & Seafood';
  if (/milk|cream|cheese|butter|egg|牛奶|奶|蛋|鸡蛋/.test(n)) return 'Dairy';
  if (/salt|sugar|sauce|oil|vinegar|soy|pepper|spice|盐|糖|酱|醋|油|生抽|老抽|料酒|胡椒|花椒|调料/.test(n)) return 'Spices & Seasonings';
  if (/rice|noodle|flour|bread|米|面|粉|淀粉/.test(n)) return 'Pantry';
  return 'Other';
}
