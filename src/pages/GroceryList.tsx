import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, ChevronDown, Download, Share2, Sparkles, RefreshCw, Calendar, Carrot, Fish, Milk, Package, Flame, HelpCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroceryItem, GROCERY_CATEGORIES } from '@/types/recipe';
import { useToast } from '@/hooks/use-toast';
import { useMealPlan } from '@/contexts/MealPlanContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export default function GroceryList() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Other');
  const [openCategories, setOpenCategories] = useState<string[]>(GROCERY_CATEGORIES);
  const [isGenerating, setIsGenerating] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isFinalized, mealSlots, generateGroceryList, isLoading: isMealPlanLoading, currentWeekStart } = useMealPlan();

  // Map category names to translation keys
  const getCategoryTranslation = (category: string) => {
    const categoryMap: Record<string, string> = {
      'Produce': 'category.produce',
      'Meat & Seafood': 'category.meatSeafood',
      'Dairy': 'category.dairy',
      'Pantry': 'category.pantry',
      'Spices & Seasonings': 'category.spices',
      'Other': 'category.other',
    };
    return t(categoryMap[category] || category);
  };

  // Debug log
  useEffect(() => {
    console.log('GroceryList state:', {
      isFinalized,
      mealSlotsCount: mealSlots.length,
      isMealPlanLoading,
      currentWeekStart: currentWeekStart?.toISOString()
    });
  }, [isFinalized, mealSlots.length, isMealPlanLoading, currentWeekStart]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleItem = (itemId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const deleteItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
    toast({
      title: 'Item removed',
      description: 'The item has been removed from your list.',
    });
  };

  const addItem = () => {
    if (!newItemName.trim()) return;

    const newItem: GroceryItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      quantity: 1,
      unit: 'item',
      category: newItemCategory,
      checked: false,
    };

    setItems(prev => [...prev, newItem]);
    setNewItemName('');
    toast({
      title: 'Item added',
      description: `${newItemName} has been added to your list.`,
    });
  };

  const clearChecked = () => {
    const checkedCount = items.filter(i => i.checked).length;
    setItems(prev => prev.filter(item => !item.checked));
    toast({
      title: 'Cleared checked items',
      description: `${checkedCount} items removed from your list.`,
    });
  };

  const clearAll = () => {
    setItems([]);
    toast({
      title: 'List cleared',
      description: 'All items have been removed.',
    });
  };

  const handleGenerateFromMealPlan = async () => {
    console.log('Generate button clicked', { user: !!user, isFinalized, mealSlotsCount: mealSlots.length });

    if (!isFinalized) {
      toast({
        title: 'Finalize your meal plan first',
        description: 'Go to Meal Planner and finalize your weekly plan before generating a grocery list',
        variant: 'destructive',
      });
      return;
    }

    if (mealSlots.length === 0) {
      toast({
        title: 'No meals in plan',
        description: 'Your meal plan is empty. Go to Meal Planner and add meals first.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const generatedItems = await generateGroceryList();
      console.log('Generated items:', generatedItems.length);
      if (generatedItems.length > 0) {
        // Merge with existing items or replace
        const existingNames = new Set(items.map(i => i.name.toLowerCase()));
        const newItems = generatedItems.filter(gi => !existingNames.has(gi.name.toLowerCase()));
        setItems(prev => [...prev, ...newItems]);
      }
    } catch (error) {
      console.error('Error generating grocery list:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate grocery list',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportList = () => {
    const listText = GROCERY_CATEGORIES
      .map(category => {
        const categoryItems = items.filter(i => i.category === category && !i.checked);
        if (categoryItems.length === 0) return '';
        return `${category}:\n${categoryItems.map(i => `  - ${i.name} (${i.quantity} ${i.unit})`).join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const blob = new Blob([listText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grocery-list.txt';
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'List exported',
      description: 'Your grocery list has been downloaded.',
    });
  };

  const shareList = async () => {
    const listText = items
      .filter(i => !i.checked)
      .map(i => `${i.name} (${i.quantity} ${i.unit})`)
      .join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Grocery List',
          text: listText,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(listText);
      toast({
        title: 'Copied to clipboard',
        description: 'Your grocery list has been copied to clipboard.',
      });
    }
  };

  // Get icon for each grocery category
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Produce':
        return <Carrot className="h-5 w-5 text-green-600" />;
      case 'Meat & Seafood':
        return <Fish className="h-5 w-5 text-red-500" />;
      case 'Dairy':
        return <Milk className="h-5 w-5 text-blue-500" />;
      case 'Pantry':
        return <Package className="h-5 w-5 text-amber-600" />;
      case 'Spices & Seasonings':
        return <Flame className="h-5 w-5 text-orange-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const groupedItems = GROCERY_CATEGORIES.reduce((acc, category) => {
    acc[category] = items.filter(item => item.category === category);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  const totalItems = items.length;
  const checkedItems = items.filter(i => i.checked).length;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
              {t('groceryList.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('groceryList.subtitle')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={shareList} disabled={items.length === 0}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={exportList} disabled={items.length === 0}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Auto-Generate from Meal Plan */}
        <Card className="mb-6 border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t('groceryList.autoGenerate')}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {isMealPlanLoading
                    ? t('groceryList.loading')
                    : isFinalized
                      ? t('groceryList.generateDesc')
                      : t('groceryList.finalizeFirst')
                  }
                </p>
                {currentWeekStart && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t('groceryList.week')}: {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Link to="/meal-planner">
                  <Button variant="outline" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('groceryList.goToPlanner')}
                  </Button>
                </Link>
                <Button
                  onClick={handleGenerateFromMealPlan}
                  disabled={isGenerating || !isFinalized || isMealPlanLoading}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {language === 'zh' ? '生成中...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t('groceryList.generateList')}
                    </>
                  )}
                </Button>
              </div>
            </div>
            {!isFinalized && (
              <Badge variant="outline" className="mt-3">
                {t('groceryList.finalizeFirst')}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Progress Card */}
        {items.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{t('groceryList.progress')}</span>
                <span className="text-sm text-muted-foreground">
                  {checkedItems} / {totalItems} {t('groceryList.items')}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex gap-2 mt-3">
                {checkedItems > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearChecked}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('groceryList.clearChecked')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('groceryList.clearAll')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Item */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder={t('groceryList.addItem')}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROCERY_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{getCategoryTranslation(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addItem} className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" />
                  {t('groceryList.add')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grocery Categories */}
        <div className="space-y-4">
          {GROCERY_CATEGORIES.map((category) => {
            const categoryItems = groupedItems[category];
            if (categoryItems.length === 0) return null;

            const categoryChecked = categoryItems.filter(i => i.checked).length;
            const isOpen = openCategories.includes(category);

            return (
              <Collapsible
                key={category}
                open={isOpen}
                onOpenChange={() => toggleCategory(category)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-display text-lg flex items-center gap-3">
                          {getCategoryIcon(category)}
                          {getCategoryTranslation(category)}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({categoryChecked}/{categoryItems.length})
                          </span>
                        </CardTitle>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 text-muted-foreground transition-transform",
                            isOpen && "rotate-180"
                          )}
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <ul className="divide-y divide-border">
                        {categoryItems.map((item) => (
                          <li
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 py-3 transition-opacity",
                              item.checked && "opacity-50"
                            )}
                          >
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="h-5 w-5"
                            />
                            <div className="flex-1">
                              <span
                                className={cn(
                                  "font-medium",
                                  item.checked && "line-through"
                                )}
                              >
                                {item.name}
                              </span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        {items.length === 0 && (
          <Card className="mt-6">
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-display text-xl font-semibold mb-2">{t('groceryList.emptyTitle')}</h3>
              <p className="text-muted-foreground">
                {t('groceryList.emptyDesc')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
