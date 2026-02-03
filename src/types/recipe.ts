export interface Recipe {
  uri: string;
  label: string;
  image: string;
  source: string;
  url: string;
  yield: number;
  dietLabels: string[];
  healthLabels: string[];
  cautions: string[];
  ingredientLines: string[];
  ingredients: Ingredient[];
  calories: number;
  totalWeight: number;
  totalTime: number;
  cuisineType: string[];
  mealType: string[];
  dishType: string[];
  totalNutrients: Record<string, NutrientInfo>;
  totalDaily: Record<string, NutrientInfo>;
}

export interface Ingredient {
  text: string;
  quantity: number;
  measure: string;
  food: string;
  weight: number;
  foodCategory: string;
  foodId: string;
  image: string;
}

export interface NutrientInfo {
  label: string;
  quantity: number;
  unit: string;
}

export interface MealPlan {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe: Recipe;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
}

export interface SearchFilters {
  query: string;
  cuisineType?: string;
  mealType?: string;
  dishType?: string;
  diet?: string;
  health?: string;
  time?: string;
  calories?: string;
}

export const CUISINE_TYPES = [
  'American', 'Asian', 'British', 'Caribbean', 'Central Europe', 
  'Chinese', 'Eastern Europe', 'French', 'Indian', 'Italian', 
  'Japanese', 'Kosher', 'Mediterranean', 'Mexican', 'Middle Eastern', 
  'Nordic', 'South American', 'South East Asian'
];

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Teatime'];

export const DISH_TYPES = [
  'Biscuits and cookies', 'Bread', 'Cereals', 'Condiments and sauces',
  'Desserts', 'Drinks', 'Main course', 'Pancake', 'Preps', 
  'Preserve', 'Salad', 'Sandwiches', 'Side dish', 'Soup', 
  'Starter', 'Sweets'
];

export const DIET_LABELS = [
  'balanced', 'high-fiber', 'high-protein', 'low-carb', 
  'low-fat', 'low-sodium'
];

export const HEALTH_LABELS = [
  'vegan', 'vegetarian', 'dairy-free', 'gluten-free', 
  'keto-friendly', 'paleo', 'peanut-free', 'tree-nut-free'
];

export const TIME_RANGES = [
  { label: 'Under 15 min', value: '0-15' },
  { label: '15-30 min', value: '15-30' },
  { label: '30-60 min', value: '30-60' },
  { label: 'Over 1 hour', value: '60+' },
];
