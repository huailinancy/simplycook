import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
import { CUISINE_TYPES, MEAL_TYPES, SupabaseRecipe } from '@/types/recipe';

interface Ingredient {
  name: string;
  amount: string;
}

interface RecipeFormData {
  name: string;
  description: string;
  cuisine: string;
  meal_type: string[];
  prep_time: number;
  cook_time: number;
  difficulty: string;
  calories: number;
  ingredients: Ingredient[];
  instructions: string[];
  image_url: string;
  tags: string[];
}

interface ImportRecipeFormProps {
  onSubmit: (recipe: RecipeFormData) => Promise<void>;
  isSubmitting?: boolean;
  onCancel?: () => void;
  initialData?: SupabaseRecipe | null;
  mode?: 'create' | 'edit';
}

export function ImportRecipeForm({ onSubmit, isSubmitting, onCancel, initialData, mode = 'create' }: ImportRecipeFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [mealType, setMealType] = useState<string[]>([]);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [calories, setCalories] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tags, setTags] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', amount: '' }]);
  const [instructions, setInstructions] = useState<string[]>(['']);

  // Populate form with initial data when editing
  useEffect(() => {
    if (initialData && mode === 'edit') {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setCuisine(initialData.cuisine || '');
      setMealType(initialData.meal_type || []);
      setPrepTime(initialData.prep_time?.toString() || '');
      setCookTime(initialData.cook_time?.toString() || '');
      setDifficulty(initialData.difficulty || '');
      setCalories(initialData.calories?.toString() || '');
      setImageUrl(initialData.image_url || '');
      setTags(initialData.tags?.join(', ') || '');
      setIngredients(
        initialData.ingredients?.length
          ? initialData.ingredients
          : [{ name: '', amount: '' }]
      );
      setInstructions(
        initialData.instructions?.length
          ? initialData.instructions
          : ['']
      );
    }
  }, [initialData, mode]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: 'name' | 'amount', value: string) => {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  };

  const addInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const removeInstruction = (index: number) => {
    if (instructions.length > 1) {
      setInstructions(instructions.filter((_, i) => i !== index));
    }
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validIngredients = ingredients.filter(i => i.name.trim() && i.amount.trim());
    const validInstructions = instructions.filter(i => i.trim());

    await onSubmit({
      name,
      description,
      cuisine,
      meal_type: mealType,
      prep_time: parseInt(prepTime) || 0,
      cook_time: parseInt(cookTime) || 0,
      difficulty,
      calories: parseInt(calories) || 0,
      ingredients: validIngredients,
      instructions: validInstructions,
      image_url: imageUrl,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'edit' ? 'Edit Recipe' : 'Add New Recipe'}</CardTitle>
        <CardDescription>
          {mode === 'edit'
            ? 'Update your recipe details below.'
            : 'Create your own recipe. It will be private by default.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Grandma's Apple Pie"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your recipe..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Select value={cuisine} onValueChange={setCuisine}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cuisine" />
                </SelectTrigger>
                <SelectContent>
                  {CUISINE_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mealType">Meal Type</Label>
              <Select value={mealType[0] || ''} onValueChange={(v) => setMealType([v])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select meal type" />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((m) => (
                    <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prepTime">Prep Time (minutes)</Label>
              <Input
                id="prepTime"
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="15"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cookTime">Cook Time (minutes)</Label>
              <Input
                id="cookTime"
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                placeholder="30"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calories">Calories (per serving)</Label>
              <Input
                id="calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="350"
                min="0"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="vegetarian, quick, healthy"
              />
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Ingredients</Label>
              <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={ingredient.amount}
                    onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                    placeholder="Amount (e.g., 2 cups)"
                    className="w-1/3"
                  />
                  <Input
                    value={ingredient.name}
                    onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                    placeholder="Ingredient name"
                    className="flex-1"
                  />
                  {ingredients.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeIngredient(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Instructions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addInstruction}>
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>
            <div className="space-y-2">
              {instructions.map((instruction, index) => (
                <div key={index} className="flex gap-2">
                  <span className="flex items-center justify-center w-8 h-10 text-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <Textarea
                    value={instruction}
                    onChange={(e) => updateInstruction(index, e.target.value)}
                    placeholder={`Step ${index + 1}...`}
                    rows={2}
                    className="flex-1"
                  />
                  {instructions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInstruction(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="btn-primary-gradient border-0">
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Recipe' : 'Save Recipe'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
