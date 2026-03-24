import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SearchFilters, Recipe } from '@/types/recipe';
import { useRecipeSearch, SortOption } from '@/hooks/useRecipeSearch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { translateFilterValue, getTimeRangeLabel } from '@/contexts/LanguageContext';
import { TIME_RANGES } from '@/types/recipe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Globe, Search, X } from 'lucide-react';

export default function Recipes() {
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { cuisines, mealTypes } = useFilterOptions();

  const communitySearch = useRecipeSearch({ source: 'community' });

  useEffect(() => {
    communitySearch.searchRecipes({ query: '' });
  }, []);

  // Auto-search when query changes
  useEffect(() => {
    communitySearch.searchRecipes(filters);
  }, [filters.query]);

  const handleSearch = () => {
    communitySearch.searchRecipes(filters);
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    communitySearch.searchRecipes(newFilters);
  };

  const clearFilters = () => {
    const newFilters = { query: filters.query };
    setFilters(newFilters);
    communitySearch.searchRecipes(newFilters);
  };

  const activeFiltersCount = [filters.cuisineType, filters.mealType, filters.time].filter(Boolean).length;

  const handleLoadMore = () => {
    communitySearch.loadMore(filters);
  };

  const handleSortChange = (value: SortOption) => {
    communitySearch.changeSortBy(filters, value);
  };

  const handleAddToMealPlan = (recipe: Recipe) => {
    toast({
      title: 'Added to meal plan',
      description: `${recipe.label} has been added to your meal plan.`,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <Layout>
      <div className="container py-4 md:py-8">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="font-display text-xl md:text-4xl font-bold mb-1 md:mb-2 flex items-center gap-2">
            <Globe className="h-5 w-5 md:h-7 md:w-7" />
            {language === 'zh' ? '社区发布' : 'Community Recipes'}
          </h1>
          <p className="text-xs md:text-base text-muted-foreground">
            {language === 'zh' ? '浏览社区用户发布的菜谱' : 'Browse recipes published by the community'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={filters.cuisineType || ''} onValueChange={(v) => handleFilterChange('cuisineType', v)}>
            <SelectTrigger className="w-[120px] md:w-[160px] h-9 text-xs md:text-sm bg-card">
              <SelectValue placeholder={language === 'zh' ? '菜系' : 'Cuisine'} />
            </SelectTrigger>
            <SelectContent>
              {cuisines.map((cuisine) => (
                <SelectItem key={cuisine} value={cuisine}>
                  {translateFilterValue(cuisine, language, 'cuisine')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.mealType || ''} onValueChange={(v) => handleFilterChange('mealType', v)}>
            <SelectTrigger className="w-[120px] md:w-[140px] h-9 text-xs md:text-sm bg-card">
              <SelectValue placeholder={language === 'zh' ? '餐类' : 'Meal Type'} />
            </SelectTrigger>
            <SelectContent>
              {mealTypes.map((meal) => (
                <SelectItem key={meal} value={meal}>
                  {translateFilterValue(meal, language, 'mealType')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.time || ''} onValueChange={(v) => handleFilterChange('time', v)}>
            <SelectTrigger className="w-[120px] md:w-[140px] h-9 text-xs md:text-sm bg-card">
              <SelectValue placeholder={language === 'zh' ? '时间' : 'Time'} />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {getTimeRangeLabel(range.value, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" />
              {language === 'zh' ? '清除筛选' : 'Clear'}
            </Button>
          )}
        </div>

        {/* Active filter badges */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.cuisineType && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {translateFilterValue(filters.cuisineType, language, 'cuisine')}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('cuisineType', '')} />
              </Badge>
            )}
            {filters.mealType && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {translateFilterValue(filters.mealType, language, 'mealType')}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('mealType', '')} />
              </Badge>
            )}
            {filters.time && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {getTimeRangeLabel(filters.time, language)}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('time', '')} />
              </Badge>
            )}
          </div>
        )}

        {/* Search bar */}
        <div className="flex gap-2 mb-4 md:mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'zh' ? '搜索社区菜谱…' : 'Search community recipes…'}
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              onKeyDown={handleKeyDown}
              className="pl-10 h-10 md:h-12 text-sm md:text-base bg-card border-border/50 focus:border-primary"
            />
          </div>
          <Button onClick={handleSearch} className="h-10 md:h-12 px-4 md:px-6 text-sm btn-primary-gradient border-0">
            {t('recipes.search')}
          </Button>
        </div>

        {/* Sort and Results info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="text-muted-foreground">
            {communitySearch.totalResults > 0 && (
              <span>{t('recipes.showing')} {communitySearch.recipes.length} {t('recipes.of')} {communitySearch.totalResults}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('recipes.sortBy')}:</span>
            <Select value={communitySearch.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('recipes.newest')}</SelectItem>
                <SelectItem value="popular">{t('recipes.popular')}</SelectItem>
                <SelectItem value="name">{t('recipes.nameAZ')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        <RecipeGridWithSaveCount
          recipes={communitySearch.recipes}
          isLoading={communitySearch.isLoading}
          onAddToMealPlan={handleAddToMealPlan}
          getSaveCount={communitySearch.getSaveCount}
          emptyMessage={language === 'zh' ? '暂无社区菜谱。发布你的菜谱来分享吧！' : 'No community recipes yet. Publish your recipes to share them!'}
        />

        {/* Load More */}
        {communitySearch.hasMore && !communitySearch.isLoading && (
          <div className="flex justify-center mt-8">
            <Button onClick={handleLoadMore} variant="outline" size="lg">
              {t('recipes.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

// Custom RecipeGrid that passes save counts
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Skeleton } from '@/components/ui/skeleton';

interface RecipeGridWithSaveCountProps {
  recipes: Recipe[];
  isLoading?: boolean;
  onAddToMealPlan?: (recipe: Recipe) => void;
  getSaveCount: (recipeUri: string) => number;
  emptyMessage?: string;
}

function RecipeGridWithSaveCount({ recipes, isLoading, onAddToMealPlan, getSaveCount, emptyMessage }: RecipeGridWithSaveCountProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <RecipeCardSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">{emptyMessage || t('recipes.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
      {recipes.map((recipe, i) => (
        <div key={recipe.uri} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          <RecipeCard
            recipe={recipe}
            onAddToMealPlan={onAddToMealPlan}
            saveCount={getSaveCount(recipe.uri)}
            showQuickLog
          />
        </div>
      ))}
    </div>
  );
}

function RecipeCardSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-soft">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
