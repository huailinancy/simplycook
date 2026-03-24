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
