import { useState, useCallback, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { useMealPlan } from '@/contexts/MealPlanContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedRecipe, SupabaseRecipe } from '@/types/recipe';
import { supabase } from '@/integrations/supabase/client';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  // Fetch all recipes once on mount so the LLM can pick from them
  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, name, english_name, cuisine, meal_type, calories, prep_time, cook_time, tags, image_url, ingredients, instructions, description, difficulty')
      .then(({ data }) => {
        if (data) setAvailableRecipes(data as SupabaseRecipe[]);
      });
  }, []);

  /** Build a readable summary of the current meal plan for the LLM */
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
            const r = s.recipe!;
            const name = getLocalizedRecipe(r, language).name;
            const cal = r.calories ? ` (${r.calories} cal)` : '';
            lines.push(`- ${label}: ${name}${cal}`);
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

        // Compact recipe list — cap at 120 to stay within token budget
        const recipeList = availableRecipes.slice(0, 120).map(r => ({
          id: r.id,
          name: getLocalizedRecipe(r, language).name,
          english_name: r.english_name,
          cuisine: r.cuisine,
          meal_type: r.meal_type,
        }));

        const { data, error } = await supabase.functions.invoke('smart-meal-chat', {
          body: {
            messages: [...messages.slice(1), userMsg], // skip welcome
            currentPlan: buildCurrentPlanText(),
            recipes: recipeList,
            weekRange: `${weekStart} – ${weekEnd}`,
          },
        });

        if (error) throw new Error(error.message);

        const reply: string = data?.reply ?? 'Sorry, I could not get a response.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

        // If the LLM returned a FILL_SLOTS action, apply it to the planner
        const action = data?.action;
        if (action?.type === 'FILL_SLOTS' && Array.isArray(action.slots) && action.slots.length > 0) {
          const newSlots = (action.slots as { dayOfWeek: number; mealType: string; recipeId: number }[])
            .map(s => {
              const recipe = availableRecipes.find(r => r.id === s.recipeId) ?? null;
              if (!recipe) return null;
              return {
                dayOfWeek: s.dayOfWeek,
                mealType: s.mealType as 'lunch' | 'dinner',
                recipe,
              };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null);

          if (newSlots.length > 0) {
            setMealSlots(newSlots);
            setPlanApplied(true);
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
