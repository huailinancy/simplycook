import { useState, useCallback, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { useMealPlan } from '@/contexts/MealPlanContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedRecipe, SupabaseRecipe, MealSlot } from '@/types/recipe';
import { supabase } from '@/integrations/supabase/client';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Cuisines that count as "Chinese" for matching purposes
const CHINESE_VARIANTS = new Set([
  '川菜', '粤菜', '湘菜', '鲁菜', '苏菜', '浙菜', '闽菜', '徽菜',
  '东北菜', '西北菜', '云南菜', '贵州菜', '家常菜', '凉菜', '热菜',
  'chinese', 'sichuan', 'cantonese', 'home-style',
]);

/** Return true if a recipe's cuisine matches the LLM-requested cuisine */
function cuisineMatches(recipeCuisine: string | null | undefined, requested: string): boolean {
  if (!recipeCuisine) return false;
  const rc = recipeCuisine.toLowerCase().trim();
  const req = requested.toLowerCase().trim();
  if (rc === req) return true;
  // Group all Chinese-family cuisines under "chinese"
  if (req === 'chinese' && CHINESE_VARIANTS.has(rc)) return true;
  if (CHINESE_VARIANTS.has(req) && CHINESE_VARIANTS.has(rc)) return true;
  // Substring match as fallback (e.g. "Italian" ↔ "italian")
  return rc.includes(req) || req.includes(rc);
}

/** Pick a random recipe matching the requested cuisine, preferring unused ones */
function pickRecipe(
  cuisine: string,
  pool: SupabaseRecipe[],
  usedIds: Set<number>
): SupabaseRecipe | null {
  const matching = pool.filter(r => cuisineMatches(r.cuisine, cuisine));
  if (matching.length === 0) return null;
  const unused = matching.filter(r => !usedIds.has(r.id));
  const candidates = unused.length > 0 ? unused : matching;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  usedIds.add(picked.id);
  return picked;
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I can answer questions about your meal plan, or generate one for you.\n\nTry: \"4 days Chinese cuisine and 3 days Italian\" — I'll fill in the planner and you can finalize it when you're happy!",
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

  /** Readable summary of the current plan for the LLM */
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
            lines.push(`- ${label}: ${name}`);
          });
        }
      }
    }
    return lines.join('\n');
  }, [mealSlots, language]);

  const sendMessage = useCallback(
    async (userText: string) => {
      const userMsg: ChatMessage = { role: 'user', content: userText };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);
      setPlanApplied(false);

      try {
        const weekStart = format(currentWeekStart, 'MMMM d');
        const weekEnd = format(addDays(currentWeekStart, 6), 'MMMM d, yyyy');

        // Send unique cuisines so the LLM knows what's available
        const availableCuisines = [
          ...new Set(availableRecipes.map(r => r.cuisine).filter(Boolean)),
        ];

        const { data, error } = await supabase.functions.invoke('smart-meal-chat', {
          body: {
            messages: [...messages.slice(1), userMsg], // skip welcome message
            currentPlan: buildCurrentPlanText(),
            availableCuisines,
            weekRange: `${weekStart} – ${weekEnd}`,
          },
        });

        if (error) throw new Error(error.message);

        const reply: string = data?.reply ?? 'Sorry, I could not get a response.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

        // Handle GENERATE_BY_CUISINE action
        const action = data?.action;
        if (
          action?.type === 'GENERATE_BY_CUISINE' &&
          Array.isArray(action.assignments) &&
          action.assignments.length > 0
        ) {
          const usedIds = new Set<number>();
          const newSlots: MealSlot[] = [];

          for (const assignment of action.assignments as {
            dayOfWeek: number;
            lunch: string;
            dinner: string;
          }[]) {
            const lunchRecipe = pickRecipe(assignment.lunch, availableRecipes, usedIds);
            const dinnerRecipe = pickRecipe(assignment.dinner, availableRecipes, usedIds);

            if (lunchRecipe) {
              newSlots.push({ dayOfWeek: assignment.dayOfWeek, mealType: 'lunch', recipe: lunchRecipe });
            }
            if (dinnerRecipe) {
              newSlots.push({ dayOfWeek: assignment.dayOfWeek, mealType: 'dinner', recipe: dinnerRecipe });
            }
          }

          if (newSlots.length > 0) {
            setMealSlots(newSlots);
            setPlanApplied(true);
          } else {
            // If no recipes matched, tell the user
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content:
                  "I couldn't find recipes matching those cuisines in the database. Try a cuisine from the available list, or add more recipes first.",
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
    [messages, buildCurrentPlanText, currentWeekStart, availableRecipes, language, setMealSlots]
  );

  return { messages, isLoading, sendMessage, planApplied };
}
