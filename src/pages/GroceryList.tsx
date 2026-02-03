import { useState } from 'react';
import { ShoppingCart, Plus, Trash2, Check, ChevronDown, Download, Share2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { GroceryItem } from '@/types/recipe';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Sample grocery items
const SAMPLE_GROCERIES: GroceryItem[] = [
  { id: '1', name: 'Chicken breast', quantity: 4, unit: 'pieces', category: 'Meat & Seafood', checked: false },
  { id: '2', name: 'Olive oil', quantity: 1, unit: 'bottle', category: 'Pantry', checked: true },
  { id: '3', name: 'Fresh basil', quantity: 1, unit: 'bunch', category: 'Produce', checked: false },
  { id: '4', name: 'Cherry tomatoes', quantity: 2, unit: 'pints', category: 'Produce', checked: false },
  { id: '5', name: 'Garlic', quantity: 1, unit: 'head', category: 'Produce', checked: false },
  { id: '6', name: 'Pasta', quantity: 1, unit: 'lb', category: 'Pantry', checked: false },
  { id: '7', name: 'Parmesan cheese', quantity: 1, unit: 'wedge', category: 'Dairy', checked: false },
  { id: '8', name: 'Heavy cream', quantity: 1, unit: 'cup', category: 'Dairy', checked: false },
];

const CATEGORIES = ['Produce', 'Meat & Seafood', 'Dairy', 'Pantry', 'Frozen', 'Other'];

export default function GroceryList() {
  const [items, setItems] = useState<GroceryItem[]>(SAMPLE_GROCERIES);
  const [newItemName, setNewItemName] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>(CATEGORIES);
  const { toast } = useToast();

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
      category: 'Other',
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

  const groupedItems = CATEGORIES.reduce((acc, category) => {
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
              Grocery List
            </h1>
            <p className="text-muted-foreground">
              Your shopping list from meal plans
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Shopping Progress</span>
              <span className="text-sm text-muted-foreground">
                {checkedItems} of {totalItems} items
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            {checkedItems > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChecked}
                className="mt-3 text-muted-foreground"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear {checkedItems} checked items
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Add Item */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                placeholder="Add an item..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                className="flex-1"
              />
              <Button onClick={addItem} className="gap-2">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Grocery Categories */}
        <div className="space-y-4">
          {CATEGORIES.map((category) => {
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
                          <ShoppingCart className="h-5 w-5 text-primary" />
                          {category}
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
              <h3 className="font-display text-xl font-semibold mb-2">Your list is empty</h3>
              <p className="text-muted-foreground">
                Add items manually or generate a list from your meal plan.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
