import { useState, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { useMealPlan } from '@/contexts/MealPlanContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedRecipe } from '@/types/recipe';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! Ask me anything about your meal plan — calories, prep time, what's planned for each day, and more.",
};

export function useMealPlanChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);

  const { mealSlots, currentWeekStart } = useMealPlan();
  const { language } = useLanguage();

  const buildSystemPrompt = useCallback((): string => {
    const weekStart = format(currentWeekStart, 'MMMM d');
    const weekEnd = format(addDays(currentWeekStart, 6), 'MMMM d, yyyy');

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
            const cal = r.calories ? ` (${r.calories} cal` : '';
            const time = (r.prep_time || r.cook_time)
              ? `, ${(r.prep_time || 0) + (r.cook_time || 0)} min)`
              : cal ? ')' : '';
            lines.push(`- ${label}: ${name}${cal}${time}`);
          });
        }
      }
    }

    return [
      `You are a helpful meal planning assistant for SimplyCook.`,
      `Current week: ${weekStart} – ${weekEnd}.`,
      ``,
      `Meal plan:`,
      ...lines,
      ``,
      `Answer the user's questions about their meal plan concisely and helpfully.`,
      `You cannot modify the plan — if asked to add, remove, or change meals, politely explain`,
      `that they can do so directly on the planner page using the recipe picker or drag-and-drop.`,
    ].join('\n');
  }, [mealSlots, currentWeekStart, language]);

  const sendMessage = useCallback(async (userText: string) => {
    const userMsg: ChatMessage = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) throw new Error('VITE_GROQ_API_KEY is not set');

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            // exclude the welcome message from history sent to API
            ...messages.slice(1),
            userMsg,
          ],
          temperature: 0.7,
          max_tokens: 512,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply: string =
        data.choices?.[0]?.message?.content ?? 'Sorry, I could not get a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${err?.message ?? 'Something went wrong.'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, buildSystemPrompt]);

  return { messages, isLoading, sendMessage };
}
