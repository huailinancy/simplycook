import { useState, useEffect } from 'react';
import { ArrowRight, ChefHat } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import heroImage from '@/assets/hero-cooking.jpg';

export default function Index() {
  const [isLoaded, setIsLoaded] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)]">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Fresh cooking ingredients"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
        </div>

        <div className="container relative py-24 md:py-32 lg:py-40">
          <div className={`max-w-2xl space-y-6 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 text-primary">
              <ChefHat className="h-5 w-5" />
              <span className="text-base md:text-lg font-medium">{t('home.recipeCompanion')}</span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-foreground leading-tight">
              {t('home.heroTitle1')} <span className="text-primary">{t('home.heroTitle2')}</span>,<br />
              {t('home.heroTitle3')}
            </h1>

            <p className="text-xl text-muted-foreground max-w-lg">
              {t('home.heroDesc')}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/recipes">
                <Button size="lg" className="gap-2 btn-primary-gradient border-0 h-12 px-6">
                  {t('home.exploreRecipes')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/meal-planner">
                <Button size="lg" variant="outline" className="h-12 px-6">
                  {t('home.planWeek')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
