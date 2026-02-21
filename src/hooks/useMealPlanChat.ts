import { useState, useCallback, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { useMealPlan } from '@/contexts/MealPlanContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedRecipe, SupabaseRecipe, MealSlot } from '@/types/recipe';
import { supabase } from '@/integrations/supabase/client';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// All cuisine strings that count as "Chinese"
const CHINESE_VARIANTS = new Set([
  '中式', '川菜', '粤菜', '湘菜', '鲁菜', '苏菜', '浙菜', '闽菜', '徽菜',
  '东北菜', '西北菜', '云南菜', '贵州菜', '家常菜', '凉菜', '热菜',
  '新疆菜',
  'chinese', 'sichuan', 'cantonese', 'home-style',
]);

/** Map common English cuisine labels to DB values */
const CUISINE_ALIAS: Record<string, string> = {
  'chinese': '中式',
  'italian': '意式',
  'western': '西式',
  'sichuan': '川菜',
  'hunan': '湘菜',
  'cantonese': '粤菜',
  'northwestern': '西北菜',
  'xinjiang': '新疆菜',
  'zhejiang': '浙菜',
};

/** True when a recipe's cuisine matches the LLM-requested cuisine label */
function cuisineMatches(recipeCuisine: string | null | undefined, requested: string): boolean {
  if (requested === 'any') return true;
  if (!recipeCuisine) return false;
  const rc = recipeCuisine.toLowerCase().trim();
  const req = requested.toLowerCase().trim();
  // Resolve English aliases to DB values
  const resolved = CUISINE_ALIAS[req] ? CUISINE_ALIAS[req].toLowerCase() : req;
  if (rc === resolved) return true;
  if (rc === req) return true;
  if ((req === 'chinese' || CHINESE_VARIANTS.has(req) || resolved === '中式') && CHINESE_VARIANTS.has(rc)) return true;
  return rc.includes(resolved) || resolved.includes(rc) || rc.includes(req) || req.includes(rc);
}

interface GenerateAction {
  type: 'GENERATE_PLAN';
  assignments: { dayOfWeek: number; lunch: string; dinner: string }[];
  maxCalories?: number | null;
  requiredTags?: string[];
}

/** Pick a random recipe that matches cuisine + global filters, preferring unused recipes */
function pickRecipe(
  cuisine: string,
  pool: SupabaseRecipe[],
  usedIds: Set<number>,
  maxCalories: number | null | undefined,
  requiredTags: string[]
): SupabaseRecipe | null {
  let candidates = pool.filter(r => {
    if (!cuisineMatches(r.cuisine, cuisine)) return false;
    if (maxCalories != null && r.calories != null && r.calories > maxCalories) return false;
    if (requiredTags.length > 0) {
      const recipeTags = (r.tags ?? []).map(t => t.toLowerCase());
      if (!requiredTags.every(tag => recipeTags.includes(tag.toLowerCase()))) return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    // Fallback: relax cuisine filter (keep calorie/tag filters)
    candidates = pool.filter(r => {
      if (maxCalories != null && r.calories != null && r.calories > maxCalories) return false;
      if (requiredTags.length > 0) {
        const recipeTags = (r.tags ?? []).map(t => t.toLowerCase());
        if (!requiredTags.every(tag => recipeTags.includes(tag.toLowerCase()))) return false;
      }
      return true;
    });
  }

  if (candidates.length === 0) return null;

  const unused = candidates.filter(r => !usedIds.has(r.id));
  const finalCandidates = unused.length > 0 ? unused : candidates;
  const picked = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
  usedIds.add(picked.id);
  return picked;
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    'Hi! I can answer questions about your meal plan, or generate one for you.\n\nExamples:\n• "4 days Chinese cuisine and 3 days Italian"\n• "A low-calorie meal plan for the week"\n• "Vegetarian meals all week"\n• "What\'s planned for Monday?"',
};

export function useMealPlanChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [planApplied, setPlanApplied] = useState(false);
  const [availableRecipes, setAvailableRecipes] = useState<SupabaseRecipe[]>([]);

  const { mealSlots, currentWeekStart, setMealSlots } = useMealPlan();
  const { language } = useLanguage();

  // Fetch all recipes once on mount
  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, name, english_name, cuisine, meal_type, calories, prep_time, cook_time, tags, image_url, ingredients, instructions, description, difficulty')
      .then(({ data }) => {
        if (data) setAvailableRecipes(data as SupabaseRecipe[]);
      });
  }, []);

  /** Readable summary of the current plan for the LLM context */
  const buildCurrentPlanText = useCallback((): string => {
    const lines: string[] = [];
    for (let day = 0; day < 7; day++) {
      for (const mealType of ['lunch', 'dinner'] as const) {
        const slots = mealSlots.filter(
          s => s.dayOfWeek === day && s.mealType === mealType && s.recipe
        );
        const label = `${DAYS[day]} ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`;
        if (slots.length === 0) {
          lines.push(`- ${label}: (empty)`);
        } else {
          slots.forEach(s => {
            const name = getLocalizedRecipe(s.recipe!, language).name;
            const cal = s.recipe!.calories ? ` (${s.recipe!.calories} cal)` : '';
            lines.push(`- ${label}: ${name}${cal}`);
          });
        }
      }
    }
    return lines.join('\n');
  }, [mealSlots, language]);

  /** Apply a GENERATE_PLAN action from the LLM to the planner */
  const applyGeneratePlan = useCallback(
    (action: GenerateAction): boolean => {
      const maxCalories = action.maxCalories ?? null;
      const requiredTags = action.requiredTags ?? [];
      const usedIds = new Set<number>();
      const newSlots: MealSlot[] = [];

      for (const assignment of action.assignments) {
        const lunchRecipe = pickRecipe(assignment.lunch, availableRecipes, usedIds, maxCalories, requiredTags);
        const dinnerRecipe = pickRecipe(assignment.dinner, availableRecipes, usedIds, maxCalories, requiredTags);
        if (lunchRecipe) newSlots.push({ dayOfWeek: assignment.dayOfWeek, mealType: 'lunch', recipe: lunchRecipe });
        if (dinnerRecipe) newSlots.push({ dayOfWeek: assignment.dayOfWeek, mealType: 'dinner', recipe: dinnerRecipe });
      }

      if (newSlots.length > 0) {
        setMealSlots(newSlots);
        return true;
      }
      return false;
    },
    [availableRecipes, setMealSlots]
  );

  const sendMessage = useCallback(
    async (userText: string) => {
      const userMsg: ChatMessage = { role: 'user', content: userText };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);
      setPlanApplied(false);

      try {
        const weekStart = format(currentWeekStart, 'MMMM d');
        const weekEnd = format(addDays(currentWeekStart, 6), 'MMMM d, yyyy');

        const availableCuisines = [
          ...new Set(availableRecipes.map(r => r.cuisine).filter(Boolean)),
        ];

        const { data, error } = await supabase.functions.invoke('smart-meal-chat', {
          body: {
            messages: [...messages.slice(1), userMsg],
            currentPlan: buildCurrentPlanText(),
            availableCuisines,
            weekRange: `${weekStart} – ${weekEnd}`,
          },
        });

        if (error) throw new Error(error.message);

        const reply: string = data?.reply ?? 'Sorry, I could not get a response.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

        // Apply the plan if the LLM returned a GENERATE_PLAN action
        const action = data?.action;
        if (action?.type === 'GENERATE_PLAN' && Array.isArray(action.assignments) && action.assignments.length > 0) {
          const applied = applyGeneratePlan(action as GenerateAction);
          if (applied) {
            setPlanApplied(true);
          } else {
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content:
                  "I couldn't find any recipes matching those requirements in the database. Try a different filter, or add more recipes in My Recipes first.",
              },
            ]);
          }
        }
      } catch (err: any) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${err?.message ?? 'Something went wrong.'}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, buildCurrentPlanText, currentWeekStart, availableRecipes, applyGeneratePlan]
  );

  return { messages, isLoading, sendMessage, planApplied };
}
