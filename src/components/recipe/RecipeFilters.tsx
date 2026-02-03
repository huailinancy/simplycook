import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SearchFilters, CUISINE_TYPES, MEAL_TYPES, DIET_LABELS, TIME_RANGES } from '@/types/recipe';
import { useState } from 'react';

interface RecipeFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
}

export function RecipeFilters({ filters, onFiltersChange, onSearch }: RecipeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({ query: filters.query });
  };

  const activeFiltersCount = Object.values(filters).filter(v => v && v !== filters.query).length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for recipes, ingredients..."
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-12 text-base bg-card border-border/50 focus:border-primary"
          />
        </div>
        
        {/* Mobile filter trigger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-12 w-12 md:hidden relative">
              <Filter className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <FilterSelects filters={filters} updateFilter={updateFilter} />
            </div>
          </SheetContent>
        </Sheet>

        <Button onClick={onSearch} className="h-12 px-6 btn-primary-gradient border-0">
          Search
        </Button>
      </div>

      {/* Desktop filters */}
      <div className="hidden md:flex flex-wrap gap-3">
        <FilterSelects filters={filters} updateFilter={updateFilter} />
        
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Active filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.cuisineType && (
            <Badge variant="secondary" className="gap-1">
              Cuisine: {filters.cuisineType}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('cuisineType', '')} />
            </Badge>
          )}
          {filters.mealType && (
            <Badge variant="secondary" className="gap-1">
              Meal: {filters.mealType}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('mealType', '')} />
            </Badge>
          )}
          {filters.diet && (
            <Badge variant="secondary" className="gap-1">
              Diet: {filters.diet}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('diet', '')} />
            </Badge>
          )}
          {filters.time && (
            <Badge variant="secondary" className="gap-1">
              Time: {TIME_RANGES.find(t => t.value === filters.time)?.label}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('time', '')} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelects({ 
  filters, 
  updateFilter 
}: { 
  filters: SearchFilters; 
  updateFilter: (key: keyof SearchFilters, value: string) => void;
}) {
  return (
    <>
      <Select value={filters.cuisineType || ''} onValueChange={(v) => updateFilter('cuisineType', v)}>
        <SelectTrigger className="w-full md:w-[160px] bg-card">
          <SelectValue placeholder="Cuisine" />
        </SelectTrigger>
        <SelectContent>
          {CUISINE_TYPES.map((cuisine) => (
            <SelectItem key={cuisine} value={cuisine.toLowerCase()}>
              {cuisine}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.mealType || ''} onValueChange={(v) => updateFilter('mealType', v)}>
        <SelectTrigger className="w-full md:w-[140px] bg-card">
          <SelectValue placeholder="Meal Type" />
        </SelectTrigger>
        <SelectContent>
          {MEAL_TYPES.map((meal) => (
            <SelectItem key={meal} value={meal.toLowerCase()}>
              {meal}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.diet || ''} onValueChange={(v) => updateFilter('diet', v)}>
        <SelectTrigger className="w-full md:w-[140px] bg-card">
          <SelectValue placeholder="Diet" />
        </SelectTrigger>
        <SelectContent>
          {DIET_LABELS.map((diet) => (
            <SelectItem key={diet} value={diet}>
              {diet.charAt(0).toUpperCase() + diet.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.time || ''} onValueChange={(v) => updateFilter('time', v)}>
        <SelectTrigger className="w-full md:w-[140px] bg-card">
          <SelectValue placeholder="Cook Time" />
        </SelectTrigger>
        <SelectContent>
          {TIME_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
