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
import { SearchFilters, TIME_RANGES } from '@/types/recipe';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useLanguage, translateFilterValue, getTimeRangeLabel } from '@/contexts/LanguageContext';
import { useState } from 'react';

interface RecipeFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
}

export function RecipeFilters({ filters, onFiltersChange, onSearch }: RecipeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { cuisines, mealTypes, isLoading: filtersLoading } = useFilterOptions();
  const { t, language } = useLanguage();

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
            placeholder={t('recipes.searchPlaceholder')}
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
              <SheetTitle>{t('recipes.filters')}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <FilterSelects filters={filters} updateFilter={updateFilter} cuisines={cuisines} mealTypes={mealTypes} t={t} language={language} />
            </div>
          </SheetContent>
        </Sheet>

        <Button onClick={onSearch} className="h-12 px-6 btn-primary-gradient border-0">
          {t('recipes.search')}
        </Button>
      </div>

      {/* Desktop filters */}
      <div className="hidden md:flex flex-wrap gap-3">
        <FilterSelects filters={filters} updateFilter={updateFilter} cuisines={cuisines} mealTypes={mealTypes} t={t} language={language} />

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            {t('recipes.clearFilters')}
          </Button>
        )}
      </div>

      {/* Active filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.cuisineType && (
            <Badge variant="secondary" className="gap-1">
              {t('recipes.cuisine')}: {translateFilterValue(filters.cuisineType, language, 'cuisine')}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('cuisineType', '')} />
            </Badge>
          )}
          {filters.mealType && (
            <Badge variant="secondary" className="gap-1">
              {t('recipes.mealType')}: {translateFilterValue(filters.mealType, language, 'mealType')}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('mealType', '')} />
            </Badge>
          )}
          {filters.time && (
            <Badge variant="secondary" className="gap-1">
              {t('recipes.time')}: {getTimeRangeLabel(filters.time, language)}
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
  updateFilter,
  cuisines,
  mealTypes,
  t,
  language,
}: {
  filters: SearchFilters;
  updateFilter: (key: keyof SearchFilters, value: string) => void;
  cuisines: string[];
  mealTypes: string[];
  t: (key: string) => string;
  language: 'en' | 'zh';
}) {
  return (
    <>
      <Select value={filters.cuisineType || ''} onValueChange={(v) => updateFilter('cuisineType', v)}>
        <SelectTrigger className="w-full md:w-[160px] bg-card">
          <SelectValue placeholder={t('recipes.cuisine')} />
        </SelectTrigger>
        <SelectContent>
          {cuisines.map((cuisine) => (
            <SelectItem key={cuisine} value={cuisine}>
              {translateFilterValue(cuisine, language, 'cuisine')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.mealType || ''} onValueChange={(v) => updateFilter('mealType', v)}>
        <SelectTrigger className="w-full md:w-[140px] bg-card">
          <SelectValue placeholder={t('recipes.mealType')} />
        </SelectTrigger>
        <SelectContent>
          {mealTypes.map((meal) => (
            <SelectItem key={meal} value={meal}>
              {translateFilterValue(meal, language, 'mealType')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.time || ''} onValueChange={(v) => updateFilter('time', v)}>
        <SelectTrigger className="w-full md:w-[140px] bg-card">
          <SelectValue placeholder={t('recipes.time')} />
        </SelectTrigger>
        <SelectContent>
          {TIME_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {getTimeRangeLabel(range.value, language)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
