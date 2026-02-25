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

// Supabase database recipe type
export interface SupabaseRecipe {
  id: number;
  name: string;
  english_name: string | null;
  description: string | null;
  english_description?: string | null;
  meal_type: string[] | null;
  cuisine: string | null;
  category: string | null;
  prep_time: number | null;
  cook_time: number | null;
  difficulty: string | null;
  calories: number | null;
  macros: {
    protein?: number;
    carbs?: number;
    fat?: number;
  } | null;
  ingredients: {
    name: string;
    amount: string;
    english_name?: string;
    english_amount?: string;
  }[] | null;
  english_ingredients: {
    name: string;
    amount: string;
  }[] | null;
  instructions: string[] | null;
  english_instructions: string[] | null;
  tags: string[] | null;
  image_url: string | null;
  created_at: string | null;
  user_id: string | null;
  is_published: boolean;
  save_count: number;
  source_url?: string | null;
}

// Helper to get localized recipe content
export function getLocalizedRecipe(recipe: SupabaseRecipe, language: 'en' | 'zh') {
  if (language === 'en') {
    return {
      name: recipe.english_name || recipe.name,
      description: recipe.english_description || recipe.description,
      ingredients: recipe.english_ingredients || recipe.ingredients,
      instructions: recipe.english_instructions || recipe.instructions,
    };
  }
  return {
    name: recipe.name,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
  };
}

// Convert Supabase recipe to app Recipe format
export function toAppRecipe(sr: SupabaseRecipe, language: 'en' | 'zh' = 'zh', authorName?: string): Recipe {
  const localized = getLocalizedRecipe(sr, language);
  const ingredients = localized.ingredients || [];

  return {
    uri: sr.id.toString(),
    label: localized.name || sr.name,
    image: sr.image_url || '/placeholder-recipe.jpg',
    source: authorName || (sr.user_id ? (language === 'zh' ? '用户创作' : 'User') : 'SimplyCook'),
    url: '#',
    yield: 2,
    dietLabels: sr.tags?.slice(0, 3) || [],
    healthLabels: [],
    cautions: [],
    ingredientLines: ingredients.map(i => `${i.amount} ${i.name}`) || [],
    ingredients: [],
    calories: (sr.calories || 0) * 2,
    totalWeight: 0,
    totalTime: (sr.prep_time || 0) + (sr.cook_time || 0),
    cuisineType: sr.cuisine ? [sr.cuisine] : [],
    mealType: sr.meal_type || [],
    dishType: sr.category ? [sr.category] : [],
    totalNutrients: {},
    totalDaily: {},
  };
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
  '川菜', '粤菜', '湘菜', '鲁菜', '苏菜', '浙菜', '闽菜', '徽菜',
  '东北菜', '西北菜', '云南菜', '贵州菜', '家常菜', '凉菜', '热菜',
  'Chinese', 'Sichuan', 'Cantonese', 'Home-style'
];

export const MEAL_TYPES = ['早餐', '午餐', '晚餐', '小吃', '甜点', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];

export const DISH_TYPES = [
  'Biscuits and cookies', 'Bread', 'Cereals', 'Condiments and sauces',
  'Desserts', 'Drinks', 'Main course', 'Pancake', 'Preps', 
  'Preserve', 'Salad', 'Sandwiches', 'Side dish', 'Soup', 
  'Starter', 'Sweets'
];

export const DIET_LABELS = [
  '素食', '低脂', '高蛋白', '低碳水', '清淡',
  'vegetarian', 'low-fat', 'high-protein', 'low-carb', 'light'
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

// User preferences types
export interface UserProfile {
  id: string;
  allergies: string[];
  flavor_preferences: string[];
  diet_preferences: string[];
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedRecipe {
  id: string;
  user_id: string;
  recipe_id: number;
  created_at: string;
}

// Preference options
export const ALLERGY_OPTIONS = [
  'Dairy',
  'Eggs',
  'Fish',
  'Shellfish',
  'Tree Nuts',
  'Peanuts',
  'Wheat',
  'Soy',
  'Sesame',
];

export const FLAVOR_PREFERENCES = [
  'Spicy',
  'Sweet',
  'Savory',
  'Sour',
  'Umami',
  'Mild',
  'Bold',
  'Herby',
  'Smoky',
];

export const DIET_PREFERENCE_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Keto',
  'Paleo',
  'Low-Carb',
  'Low-Fat',
  'Mediterranean',
  'Whole30',
];

// Meal Plan types
export type MealSlotType = 'lunch' | 'dinner';

export interface WeeklyMealPlan {
  id?: string;
  weekStart: string; // ISO date string for Monday
  isFinalized: boolean;
  meals: MealSlot[];
}

export interface MealSlot {
  id?: string;
  dayOfWeek: number; // 0 = Monday, 6 = Sunday
  mealType: MealSlotType;
  recipe: SupabaseRecipe | null;
}

export type RecipeSource = 'all' | 'saved' | 'my-recipes';

export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

export const GROCERY_CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy',
  'Pantry',
  'Spices & Seasonings',
  'Other'
];
