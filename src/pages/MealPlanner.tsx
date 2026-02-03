import { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2, Flame, Clock } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MealPlan, Recipe } from '@/types/recipe';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

// Sample meal plan data
const SAMPLE_MEALS: MealPlan[] = [
  {
    id: '1',
    date: format(new Date(), 'yyyy-MM-dd'),
    mealType: 'dinner',
    recipe: {
      uri: '1',
      label: 'Mediterranean Grilled Chicken',
      image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500',
      source: 'Home Kitchen',
      url: '#',
      yield: 4,
      dietLabels: ['High-Protein'],
      healthLabels: [],
      cautions: [],
      ingredientLines: [],
      ingredients: [],
      calories: 420,
      totalWeight: 500,
      totalTime: 35,
      cuisineType: ['mediterranean'],
      mealType: ['dinner'],
      dishType: ['main course'],
      totalNutrients: {},
      totalDaily: {},
    },
  },
];

export default function MealPlanner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [mealPlans, setMealPlans] = useState<MealPlan[]>(SAMPLE_MEALS);
  const { toast } = useToast();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  const goToPreviousWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const goToNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const goToThisWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getMealsForDay = (date: Date, mealType: string) => {
    return mealPlans.filter(
      (meal) => meal.date === format(date, 'yyyy-MM-dd') && meal.mealType === mealType
    );
  };

  const removeMeal = (mealId: string) => {
    setMealPlans(prev => prev.filter(m => m.id !== mealId));
    toast({
      title: 'Meal removed',
      description: 'The meal has been removed from your plan.',
    });
  };

  const totalCaloriesForDay = (date: Date) => {
    const dayMeals = mealPlans.filter(m => m.date === format(date, 'yyyy-MM-dd'));
    return dayMeals.reduce((sum, meal) => sum + Math.round(meal.recipe.calories / meal.recipe.yield), 0);
  };

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
              Meal Planner
            </h1>
            <p className="text-muted-foreground">
              Plan your weekly meals and stay organized
            </p>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToThisWeek}>
              This Week
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week Header */}
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {format(currentWeekStart, 'MMMM d')} - {format(addDays(currentWeekStart, 6), 'MMMM d, yyyy')}
          </h2>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const dayCalories = totalCaloriesForDay(day);
            
            return (
              <Card 
                key={day.toISOString()} 
                className={cn(
                  "min-h-[300px] transition-all",
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
                    const meals = getMealsForDay(day, mealType);
                    return (
                      <div key={mealType} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground capitalize">
                            {mealType}
                          </span>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5">
                                <Plus className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add {mealType} for {format(day, 'EEEE, MMM d')}</DialogTitle>
                              </DialogHeader>
                              <div className="py-4 text-center text-muted-foreground">
                                <p>Connect to Edamam API to search and add recipes.</p>
                                <p className="text-sm mt-2">Go to the Recipes page to browse available recipes.</p>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        
                        {meals.map((meal) => (
                          <div
                            key={meal.id}
                            className="group relative bg-muted rounded-lg p-2 text-xs"
                          >
                            <img
                              src={meal.recipe.image}
                              alt={meal.recipe.label}
                              className="w-full h-12 object-cover rounded mb-1"
                            />
                            <p className="font-medium line-clamp-1">{meal.recipe.label}</p>
                            <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-0.5">
                                <Flame className="h-3 w-3" />
                                {Math.round(meal.recipe.calories / meal.recipe.yield)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {meal.recipe.totalTime}m
                              </span>
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeMeal(meal.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Weekly Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="font-display">Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-primary">{mealPlans.length}</p>
                <p className="text-sm text-muted-foreground">Meals Planned</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-spice">
                  {mealPlans.reduce((sum, m) => sum + Math.round(m.recipe.calories / m.recipe.yield), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Calories</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-herb">
                  {mealPlans.reduce((sum, m) => sum + m.recipe.ingredients.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Ingredients</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-accent">
                  {mealPlans.reduce((sum, m) => sum + (m.recipe.totalTime || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Prep (min)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
