import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { MealSlot, SupabaseRecipe, GroceryItem, getLocalizedRecipe } from '@/types/recipe';
import { format, addDays } from 'date-fns';

// Chinese to English ingredient translations
const INGREDIENT_TRANSLATIONS: Record<string, string> = {
  // Proteins
  '鸡': 'Chicken', '鸡肉': 'Chicken', '鸡胸': 'Chicken Breast', '鸡腿': 'Chicken Leg', '鸡翅': 'Chicken Wings',
  '牛肉': 'Beef', '牛': 'Beef', '肥牛': 'Beef Slices', '牛腩': 'Beef Brisket',
  '猪肉': 'Pork', '猪': 'Pork', '五花肉': 'Pork Belly', '排骨': 'Pork Ribs', '猪肉末': 'Ground Pork',
  '羊肉': 'Lamb', '羊': 'Lamb', '羊排': 'Lamb Chops',
  '鱼': 'Fish', '虾': 'Shrimp', '虾仁': 'Shrimp', '蟹': 'Crab', '鱿鱼': 'Squid',
  '豆腐': 'Tofu', '嫩豆腐': 'Soft Tofu', '老豆腐': 'Firm Tofu', '鸡蛋': 'Eggs', '蛋': 'Eggs',
  // Vegetables
  '葱': 'Scallion', '小葱': 'Scallion', '大葱': 'Green Onion', '洋葱': 'Onion',
  '姜': 'Ginger', '生姜': 'Ginger', '蒜': 'Garlic', '大蒜': 'Garlic',
  '辣椒': 'Chili Pepper', '青椒': 'Green Pepper', '红椒': 'Red Pepper', '干辣椒': 'Dried Chili',
  '番茄': 'Tomato', '西红柿': 'Tomato', '土豆': 'Potato', '马铃薯': 'Potato',
  '茄子': 'Eggplant', '黄瓜': 'Cucumber', '胡萝卜': 'Carrot', '萝卜': 'Radish', '白萝卜': 'White Radish',
  '白菜': 'Chinese Cabbage', '大白菜': 'Napa Cabbage', '小白菜': 'Bok Choy', '娃娃菜': 'Baby Cabbage',
  '青菜': 'Green Vegetables', '菠菜': 'Spinach', '生菜': 'Lettuce', '芹菜': 'Celery',
  '蘑菇': 'Mushroom', '香菇': 'Shiitake Mushroom', '金针菇': 'Enoki Mushroom', '木耳': 'Wood Ear Mushroom',
  '豆芽': 'Bean Sprouts', '韭菜': 'Chinese Chives', '香菜': 'Cilantro', '花生': 'Peanuts',
  '玉米': 'Corn', '毛豆': 'Edamame', '四季豆': 'Green Beans', '豆角': 'String Beans',
  '莲藕': 'Lotus Root', '藕': 'Lotus Root', '笋': 'Bamboo Shoots', '冬笋': 'Winter Bamboo Shoots',
  '西兰花': 'Broccoli', '花菜': 'Cauliflower', '南瓜': 'Pumpkin', '冬瓜': 'Winter Melon', '丝瓜': 'Loofah',
  // Seasonings
  '盐': 'Salt', '糖': 'Sugar', '白糖': 'White Sugar', '冰糖': 'Rock Sugar',
  '酱油': 'Soy Sauce', '生抽': 'Light Soy Sauce', '老抽': 'Dark Soy Sauce',
  '醋': 'Vinegar', '米醋': 'Rice Vinegar', '香醋': 'Black Vinegar',
  '料酒': 'Cooking Wine', '蚝油': 'Oyster Sauce', '豆瓣酱': 'Doubanjiang', '郫县豆瓣酱': 'Pixian Doubanjiang',
  '芝麻油': 'Sesame Oil', '香油': 'Sesame Oil', '麻油': 'Sesame Oil',
  '花椒': 'Sichuan Peppercorn', '胡椒': 'Pepper', '胡椒粉': 'Pepper Powder', '花椒粉': 'Sichuan Pepper Powder',
  '八角': 'Star Anise', '桂皮': 'Cinnamon', '香叶': 'Bay Leaf',
  '五香粉': 'Five Spice Powder', '十三香': 'Thirteen Spice', '孜然': 'Cumin',
  '味精': 'MSG', '鸡精': 'Chicken Powder', '淀粉': 'Starch', '玉米淀粉': 'Cornstarch',
  '食用油': 'Cooking Oil', '油': 'Oil', '植物油': 'Vegetable Oil',
  // Staples
  '米': 'Rice', '大米': 'Rice', '米饭': 'Cooked Rice', '面': 'Noodles', '面条': 'Noodles',
  '粉': 'Rice Noodles', '米粉': 'Rice Noodles', '粉丝': 'Glass Noodles',
  '面粉': 'Flour', '高汤': 'Stock', '鸡汤': 'Chicken Stock', '水': 'Water',
};

// Translate Chinese ingredient name to English
function translateIngredient(name: string): string {
  const nameLower = name.toLowerCase().trim();

  // Direct match
  if (INGREDIENT_TRANSLATIONS[name]) {
    return INGREDIENT_TRANSLATIONS[name];
  }

  // Try to find partial match
  for (const [chinese, english] of Object.entries(INGREDIENT_TRANSLATIONS)) {
    if (name.includes(chinese)) {
      return english;
    }
  }

  // Return original if no translation found
  return name;
}

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
        .eq('name', weekStartStr)
        .maybeSingle();

      if (planError) throw planError;

      if (!planData) {
        setMealSlots([]);
        setIsFinalized(false);
        setMealPlanId(null);
        return;
      }

      setMealPlanId(planData.id);
      
      // Parse meal_slots JSON - it stores { slots: MealSlot[], isFinalized: boolean }
      const stored = planData.meal_slots as any;
      if (stored && typeof stored === 'object') {
        setIsFinalized(stored.isFinalized || false);
        const slots: MealSlot[] = (stored.slots || []).map((item: any) => ({
          id: item.id,
          dayOfWeek: item.dayOfWeek,
          mealType: item.mealType as 'lunch' | 'dinner',
          recipe: item.recipe as SupabaseRecipe | null,
        }));
        setMealSlots(slots);
      } else {
        setMealSlots([]);
        setIsFinalized(false);
      }
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

      const mealSlotsJson = {
        isFinalized: isFinalized,
        slots: mealSlots.filter(slot => slot.recipe).map(slot => ({
          dayOfWeek: slot.dayOfWeek,
          mealType: slot.mealType,
          recipe: slot.recipe,
        })),
      };

      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: user.id,
          name: weekStartStr,
          meal_slots: mealSlotsJson as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,name' })
        .select()
        .single();

      if (planError) throw planError;

      setMealPlanId(planData!.id);
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

        // Translate ingredient name if in English mode
        const displayName = language === 'en' ? translateIngredient(ingredient.name) : ingredient.name;
        const displayKey = displayName.toLowerCase().trim();

        const existing = ingredientMap.get(displayKey);
        if (existing) {
          if (existing.unit === unit) existing.quantity += qty;
          else existing.quantity += 1;
        } else {
          ingredientMap.set(displayKey, { quantity: qty, unit, category: categorizeIngredient(displayName) });
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
