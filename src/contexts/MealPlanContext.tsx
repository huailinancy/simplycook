import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { MealSlot, SupabaseRecipe, WeeklyMealPlan, GroceryItem, GROCERY_CATEGORIES, getLocalizedRecipe } from '@/types/recipe';
import { format, startOfWeek, addDays } from 'date-fns';

// Helper function to generate grocery list using Supabase Edge Function
async function generateGroceryListWithAI(recipeNames: string[], language: 'en' | 'zh' = 'zh'): Promise<GroceryItem[]> {
  console.log('generateGroceryListWithAI called with', recipeNames.length, 'recipes');

  const { data, error } = await supabase.functions.invoke('generate-grocery-list', {
    body: {
      recipeNames,
      language,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate grocery list');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  // Parse the text response into grocery items
  const groceryText = data.groceryList;
  const lines = groceryText.split('\n').filter((line: string) => line.trim());

  const items: GroceryItem[] = [];
  let currentCategory = 'Other';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a category header
    if (trimmed.endsWith(':') || trimmed.match(/^(Proteins?|Vegetables?|Seasonings?|Sauces?|Staples?|Produce|Meat|Seafood|Dairy|Pantry|Frozen|Spices?|Other|肉类|蔬菜|调味料|主食|其他)/i)) {
      currentCategory = matchCategory(trimmed.replace(':', '').trim());
      continue;
    }

    // Skip empty lines or headers
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;

    // Parse ingredient line (e.g., "- Chicken breast: 500g" or "鸡胸肉 500克")
    const cleanLine = trimmed.replace(/^[-*•]\s*/, '').trim();
    if (!cleanLine) continue;

    // Try to extract quantity and unit
    const match = cleanLine.match(/(.+?)[:：]?\s*([\d.]+)?\s*(g|kg|ml|L|oz|lb|lbs|cups?|tbsp|tsp|pieces?|个|斤|克|毫升|升|把|根|瓶|罐|包)?$/i);

    let name = cleanLine;
    let quantity = 1;
    let unit = language === 'en' ? 'item' : '个';

    if (match) {
      name = match[1].trim();
      if (match[2]) quantity = parseFloat(match[2]);
      if (match[3]) unit = match[3];
    }

    items.push({
      id: `ai-${items.length}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      quantity,
      unit,
      category: currentCategory,
      checked: false,
    });
  }

  return items;
}

// Helper to match AI category to our predefined categories
function matchCategory(aiCategory: string): string {
  const cat = (aiCategory || '').toLowerCase().trim();

  if (cat.includes('produce') || cat.includes('vegetable') || cat.includes('fruit') || cat.includes('蔬菜')) {
    return 'Produce';
  }
  if (cat.includes('meat') || cat.includes('seafood') || cat.includes('fish') || cat.includes('poultry') || cat.includes('protein') || cat.includes('肉')) {
    return 'Meat & Seafood';
  }
  if (cat.includes('dairy') || cat.includes('milk') || cat.includes('cheese') || cat.includes('egg') || cat.includes('奶') || cat.includes('蛋')) {
    return 'Dairy';
  }
  if (cat.includes('pantry') || cat.includes('grain') || cat.includes('pasta') || cat.includes('rice') || cat.includes('canned') || cat.includes('dry') || cat.includes('staple') || cat.includes('主食')) {
    return 'Pantry';
  }
  if (cat.includes('frozen')) {
    return 'Frozen';
  }
  if (cat.includes('spice') || cat.includes('season') || cat.includes('herb') || cat.includes('condiment') || cat.includes('sauce') || cat.includes('调味')) {
    return 'Spices & Seasonings';
  }
  return 'Other';
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
  // Default to tomorrow as the start of the 7-day meal plan
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    addDays(new Date(), 1)
  );
  const [mealSlots, setMealSlots] = useState<MealSlot[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mealPlanId, setMealPlanId] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { language, t } = useLanguage();

  // Track previous user to detect logout
  const [prevUser, setPrevUser] = useState(user);

  // Load meal plan when week changes or user changes
  useEffect(() => {
    // Only load from database if user is logged in
    if (user) {
      loadMealPlan();
    } else if (prevUser && !user) {
      // Only clear state when user logs out (was logged in, now not)
      setMealSlots([]);
      setIsFinalized(false);
      setMealPlanId(null);
    }
    // Don't clear state for users who were never logged in - let them use local state
    setPrevUser(user);
  }, [user, currentWeekStart]);

  const loadMealPlan = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
      console.log('Loading meal plan for week:', weekStartStr);

      // First, get the meal plan for this week
      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .single();

      if (planError) {
        if (planError.code === 'PGRST116') {
          // No meal plan exists for this week
          console.log('No meal plan found for this week');
          setMealSlots([]);
          setIsFinalized(false);
          setMealPlanId(null);
          return;
        }
        throw planError;
      }

      console.log('Found meal plan:', planData.id, 'isFinalized:', planData.is_finalized);
      setMealPlanId(planData.id);
      setIsFinalized(planData.is_finalized || false);

      // Get meal plan items with recipe data
      const { data: itemsData, error: itemsError } = await supabase
        .from('meal_plan_items')
        .select(`
          id,
          day_of_week,
          meal_type,
          recipe_id,
          recipes (*)
        `)
        .eq('meal_plan_id', planData.id);

      if (itemsError) throw itemsError;

      console.log('Loaded meal plan items:', itemsData?.length || 0);

      const slots: MealSlot[] = (itemsData || []).map((item: any) => ({
        id: item.id,
        dayOfWeek: item.day_of_week,
        mealType: item.meal_type as 'lunch' | 'dinner',
        recipe: item.recipes as SupabaseRecipe,
      }));

      setMealSlots(slots);

    } catch (error) {
      console.error('Error loading meal plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to load meal plan',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, currentWeekStart, toast]);

  const saveMealPlan = useCallback(async () => {
    // If not logged in, just show a message but keep the local state
    if (!user) {
      toast({
        title: t('mealPlan.savedLocal'),
        description: t('mealPlan.savedLocalDesc'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      // Upsert the meal plan
      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: user.id,
          week_start: weekStartStr,
          is_finalized: isFinalized,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,week_start',
        })
        .select()
        .single();

      if (planError) throw planError;

      const planId = planData.id;
      setMealPlanId(planId);

      // Delete existing items for this plan
      await supabase
        .from('meal_plan_items')
        .delete()
        .eq('meal_plan_id', planId);

      // Insert new items
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
          const { error: insertError } = await supabase
            .from('meal_plan_items')
            .insert(items);

          if (insertError) throw insertError;
        }
      }

      toast({
        title: t('mealPlan.saved'),
        description: t('mealPlan.savedDesc'),
      });

    } catch (error) {
      console.error('Error saving meal plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to save meal plan',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, currentWeekStart, mealSlots, isFinalized, toast]);

  const finalizeMealPlan = useCallback(async () => {
    if (mealSlots.length === 0) {
      toast({
        title: t('mealPlan.noMeals'),
        description: t('mealPlan.noMealsDesc'),
        variant: 'destructive',
      });
      return;
    }

    // If not logged in, just set local state as finalized
    if (!user) {
      setIsFinalized(true);
      toast({
        title: t('mealPlan.finalized'),
        description: t('mealPlan.finalizedLocal'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      // Upsert the meal plan with finalized = true
      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .upsert({
          user_id: user.id,
          week_start: weekStartStr,
          is_finalized: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,week_start',
        })
        .select()
        .single();

      if (planError) throw planError;

      const planId = planData.id;
      setMealPlanId(planId);

      // Delete existing items for this plan
      await supabase
        .from('meal_plan_items')
        .delete()
        .eq('meal_plan_id', planId);

      // Insert new items
      const items = mealSlots
        .filter(slot => slot.recipe)
        .map(slot => ({
          meal_plan_id: planId,
          recipe_id: slot.recipe!.id,
          day_of_week: slot.dayOfWeek,
          meal_type: slot.mealType,
        }));

      if (items.length > 0) {
        const { error: insertError } = await supabase
          .from('meal_plan_items')
          .insert(items);

        if (insertError) throw insertError;
      }

      setIsFinalized(true);

      toast({
        title: t('mealPlan.finalized'),
        description: t('mealPlan.finalizedDesc'),
      });

    } catch (error: any) {
      console.error('Error finalizing meal plan:', error);
      const errorMsg = error?.message || error?.code || 'Failed to finalize meal plan';
      toast({
        title: 'Error',
        description: errorMsg.includes('meal_plans')
          ? 'Database table not found. Please run the meal_plans migration in Supabase SQL Editor.'
          : errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, currentWeekStart, mealSlots, toast]);

  // Add a dish to a meal slot (allows multiple dishes per meal)
  const addDishToMeal = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner', recipe: SupabaseRecipe) => {
    setMealSlots(prev => [...prev, { dayOfWeek, mealType, recipe }]);
  }, []);

  // Remove a specific dish from a meal slot by recipe ID
  const removeDish = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner', recipeId: number) => {
    setMealSlots(prev => {
      // Find the first matching slot and remove it (in case same recipe added multiple times)
      const index = prev.findIndex(
        s => s.dayOfWeek === dayOfWeek && s.mealType === mealType && s.recipe?.id === recipeId
      );
      if (index === -1) return prev;
      return [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  }, []);

  const addMealSlot = useCallback((slot: MealSlot) => {
    setMealSlots(prev => {
      // Remove existing slot for this day/meal combo (for backward compatibility)
      const filtered = prev.filter(
        s => !(s.dayOfWeek === slot.dayOfWeek && s.mealType === slot.mealType)
      );
      return [...filtered, slot];
    });
  }, []);

  const removeMealSlot = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner') => {
    setMealSlots(prev =>
      prev.filter(s => !(s.dayOfWeek === dayOfWeek && s.mealType === mealType))
    );
  }, []);

  const updateMealSlot = useCallback((dayOfWeek: number, mealType: 'lunch' | 'dinner', recipe: SupabaseRecipe | null) => {
    if (recipe) {
      addMealSlot({ dayOfWeek, mealType, recipe });
    } else {
      removeMealSlot(dayOfWeek, mealType);
    }
  }, [addMealSlot, removeMealSlot]);

  const clearMealPlan = useCallback(() => {
    setMealSlots([]);
    setIsFinalized(false);
  }, []);

  // Reset meal plan (unfinalize) to allow regeneration
  const resetMealPlan = useCallback(async () => {
    // If not logged in, just clear local state
    if (!user) {
      setMealSlots([]);
      setIsFinalized(false);
      toast({
        title: t('mealPlan.reset'),
        description: t('mealPlan.resetDesc'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      // Update the meal plan as not finalized
      if (mealPlanId) {
        await supabase
          .from('meal_plans')
          .update({ is_finalized: false, updated_at: new Date().toISOString() })
          .eq('id', mealPlanId);
      }

      // Clear the meal slots and reset finalized state
      setMealSlots([]);
      setIsFinalized(false);

      toast({
        title: t('mealPlan.reset'),
        description: t('mealPlan.resetDesc'),
      });

    } catch (error) {
      console.error('Error resetting meal plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset meal plan',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, currentWeekStart, mealPlanId, toast]);

  // Generate grocery list from finalized meal plan
  const generateGroceryList = useCallback(async (): Promise<GroceryItem[]> => {
    console.log('generateGroceryList called', { isFinalized, mealSlotsCount: mealSlots.length });

    if (!isFinalized) {
      toast({
        title: 'Finalize your meal plan first',
        description: 'Please finalize your meal plan before generating a grocery list',
        variant: 'destructive',
      });
      return [];
    }

    if (mealSlots.length === 0) {
      toast({
        title: 'No meals in plan',
        description: 'Your meal plan is empty. Add some meals first.',
        variant: 'destructive',
      });
      return [];
    }

    // Get localized recipe names for AI generation
    const recipeNames = mealSlots
      .filter(s => s.recipe)
      .map(s => getLocalizedRecipe(s.recipe!, language).name)
      .filter((name, index, self) => self.indexOf(name) === index);

    console.log('Recipe names for grocery generation:', recipeNames);

    if (recipeNames.length > 0) {
      try {
        console.log('Calling Edge Function to generate grocery list...');
        const aiGroceryList = await generateGroceryListWithAI(recipeNames, language);
        console.log('Generated items:', aiGroceryList.length);

        if (aiGroceryList.length > 0) {
          toast({
            title: t('groceryList.generated'),
            description: `${aiGroceryList.length} ${t('groceryList.aiGeneratedDesc')}`,
          });
          return aiGroceryList;
        }
      } catch (aiError: any) {
        console.error('Grocery generation failed:', aiError);
        toast({
          title: 'Generation Failed',
          description: aiError?.message || 'Failed to generate grocery list',
          variant: 'destructive',
        });

        // Fall back to extracting from recipe ingredients
        return extractIngredientsFromRecipes();
      }
    }

    return extractIngredientsFromRecipes();
  }, [isFinalized, mealSlots, toast, language, t]);

  // Extract ingredients directly from recipe data as fallback
  const extractIngredientsFromRecipes = useCallback((): GroceryItem[] => {
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
          if (existing.unit === unit) {
            existing.quantity += qty;
          } else {
            existing.quantity += 1;
          }
        } else {
          ingredientMap.set(key, {
            quantity: qty,
            unit,
            category: categorizeIngredient(ingredient.name),
          });
        }
      }
    }

    if (ingredientMap.size === 0) {
      toast({
        title: t('groceryList.noIngredientsFound'),
        description: t('groceryList.noIngredientsDesc'),
        variant: 'destructive',
      });
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

    toast({
      title: t('groceryList.generated'),
      description: `${groceryList.length} ${t('groceryList.generatedDesc')}`,
    });

    return groceryList;
  }, [mealSlots, language, toast, t]);

  return (
    <MealPlanContext.Provider value={{
      currentWeekStart,
      mealSlots,
      isFinalized,
      isLoading,
      mealPlanId,
      setCurrentWeekStart,
      setMealSlots,
      addMealSlot,
      addDishToMeal,
      removeDish,
      removeMealSlot,
      updateMealSlot,
      saveMealPlan,
      loadMealPlan,
      finalizeMealPlan,
      resetMealPlan,
      clearMealPlan,
      generateGroceryList,
    }}>
      {children}
    </MealPlanContext.Provider>
  );
}

export function useMealPlan() {
  const context = useContext(MealPlanContext);
  if (context === undefined) {
    throw new Error('useMealPlan must be used within a MealPlanProvider');
  }
  return context;
}

// Helper function to categorize ingredients
function categorizeIngredient(name: string): string {
  const nameLower = name.toLowerCase();

  if (/vegetable|lettuce|tomato|onion|garlic|pepper|carrot|celery|cucumber|broccoli|spinach|cabbage|mushroom|potato|eggplant|zucchini|bean|pea|corn|ginger|scallion|chive|cilantro|parsley|basil|herb|茄子|番茄|西红柿|洋葱|葱|蒜|辣椒|青椒|胡萝卜|芹菜|黄瓜|西兰花|菠菜|白菜|蘑菇|香菇|金针菇|木耳|土豆|马铃薯|豆|玉米|姜|生姜|香菜|韭菜|萝卜|青菜|菜|瓜|笋|藕|芋|豆芽|豆腐|菌/.test(nameLower)) {
    return 'Produce';
  }

  if (/chicken|beef|pork|lamb|fish|shrimp|prawn|crab|lobster|meat|steak|bacon|sausage|ham|turkey|duck|seafood|salmon|tuna|cod|intestine|鸡|牛|猪|羊|鱼|虾|蟹|龙虾|肉|培根|香肠|火腿|鸭|三文鱼|金枪鱼|排骨|肥肠|腊肉|腊肠|鱿鱼|贝|蛤|蚝|海鲜/.test(nameLower)) {
    return 'Meat & Seafood';
  }

  if (/milk|cream|cheese|butter|yogurt|egg|dairy|牛奶|奶|奶酪|芝士|黄油|酸奶|蛋|鸡蛋/.test(nameLower)) {
    return 'Dairy';
  }

  if (/spice|pepper|salt|cumin|paprika|cinnamon|oregano|thyme|rosemary|bay|chili|curry|garam|turmeric|coriander|fennel|star anise|sichuan|szechuan|five spice|sesame|soy sauce|vinegar|oil|sauce|paste|seasoning|盐|糖|冰糖|白糖|红糖|酱|醋|油|生抽|老抽|酱油|蚝油|料酒|味精|鸡精|胡椒|花椒|八角|桂皮|香料|调料|辣椒|豆瓣|芝麻|麻油|香油|葱姜蒜|五香粉|十三香|孜然/.test(nameLower)) {
    return 'Spices & Seasonings';
  }

  if (/rice|noodle|pasta|flour|honey|bread|cereal|oat|bean|lentil|chickpea|tofu|can|dried|nut|peanut|almond|seed|stock|broth|米|面|粉|蜂蜜|面包|燕麦|干|罐|坚果|花生|杏仁|淀粉|高汤|汤/.test(nameLower)) {
    return 'Pantry';
  }

  return 'Other';
}
