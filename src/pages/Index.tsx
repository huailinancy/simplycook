import { useState, useEffect } from 'react';
import { ArrowRight, ChefHat, Clock, Utensils, Calendar, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { Recipe } from '@/types/recipe';
import heroImage from '@/assets/hero-cooking.jpg';

// Sample featured recipes for demo (will be replaced with Edamam API)
const FEATURED_RECIPES: Recipe[] = [
  {
    uri: '1',
    label: 'Mediterranean Grilled Chicken',
    image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500',
    source: 'Home Kitchen',
    url: '#',
    yield: 4,
    dietLabels: ['High-Protein', 'Low-Carb'],
    healthLabels: ['Gluten-Free'],
    cautions: [],
    ingredientLines: [],
    ingredients: [],
    calories: 420,
    totalWeight: 500,
    totalTime: 35,
    cuisineType: ['mediterranean'],
    mealType: ['dinner'],
    dishType: ['main course'],
    totalNutrients: {},
    totalDaily: {},
  },
  {
    uri: '2',
    label: 'Fresh Garden Salad with Citrus Dressing',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500',
    source: 'Healthy Eats',
    url: '#',
    yield: 2,
    dietLabels: ['Low-Fat', 'High-Fiber'],
    healthLabels: ['Vegan', 'Gluten-Free'],
    cautions: [],
    ingredientLines: [],
    ingredients: [],
    calories: 180,
    totalWeight: 300,
    totalTime: 15,
    cuisineType: ['american'],
    mealType: ['lunch'],
    dishType: ['salad'],
    totalNutrients: {},
    totalDaily: {},
  },
  {
    uri: '3',
    label: 'Creamy Tuscan Pasta',
    image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500',
    source: 'Italian Kitchen',
    url: '#',
    yield: 4,
    dietLabels: ['Balanced'],
    healthLabels: ['Vegetarian'],
    cautions: [],
    ingredientLines: [],
    ingredients: [],
    calories: 580,
    totalWeight: 450,
    totalTime: 30,
    cuisineType: ['italian'],
    mealType: ['dinner'],
    dishType: ['main course'],
    totalNutrients: {},
    totalDaily: {},
  },
  {
    uri: '4',
    label: 'Thai Basil Stir Fry',
    image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500',
    source: 'Asian Fusion',
    url: '#',
    yield: 2,
    dietLabels: ['High-Protein'],
    healthLabels: ['Dairy-Free'],
    cautions: [],
    ingredientLines: [],
    ingredients: [],
    calories: 380,
    totalWeight: 400,
    totalTime: 20,
    cuisineType: ['south east asian'],
    mealType: ['dinner'],
    dishType: ['main course'],
    totalNutrients: {},
    totalDaily: {},
  },
];

const features = [
  {
    icon: Utensils,
    title: 'Curated Recipes',
    description: 'Discover thousands of reliable recipes from around the world',
  },
  {
    icon: Calendar,
    title: 'Meal Planning',
    description: 'Plan your weekly meals with our intuitive calendar',
  },
  {
    icon: ShoppingCart,
    title: 'Smart Grocery Lists',
    description: 'Auto-generate shopping lists from your meal plans',
  },
];

const cuisineCategories = [
  { name: 'Italian', emoji: '🇮🇹', color: 'bg-red-100' },
  { name: 'Mexican', emoji: '🇲🇽', color: 'bg-green-100' },
  { name: 'Japanese', emoji: '🇯🇵', color: 'bg-pink-100' },
  { name: 'Indian', emoji: '🇮🇳', color: 'bg-orange-100' },
  { name: 'Mediterranean', emoji: '🌊', color: 'bg-blue-100' },
  { name: 'Chinese', emoji: '🇨🇳', color: 'bg-yellow-100' },
];

export default function Index() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
              <ChefHat className="h-4 w-4" />
              <span className="text-sm font-medium">Your Recipe Companion</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Cook with <span className="text-primary">Confidence</span>,<br />
              Every Single Day
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg">
              Discover delicious recipes, plan your meals, and generate grocery lists — 
              all in one place. Your kitchen journey starts here.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/recipes">
                <Button size="lg" className="gap-2 btn-primary-gradient border-0 h-12 px-6">
                  Explore Recipes
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/meal-planner">
                <Button size="lg" variant="outline" className="h-12 px-6">
                  Plan Your Week
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 section-gradient">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`p-6 rounded-2xl bg-card shadow-soft transition-all duration-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cuisine Categories */}
      <section className="py-16">
        <div className="container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl font-bold mb-2">Explore Cuisines</h2>
              <p className="text-muted-foreground">Discover recipes from around the world</p>
            </div>
            <Link to="/recipes">
              <Button variant="ghost" className="gap-2">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {cuisineCategories.map((cuisine, i) => (
              <Link
                key={cuisine.name}
                to={`/recipes?cuisine=${cuisine.name.toLowerCase()}`}
                className={`group p-4 rounded-2xl bg-card shadow-soft hover:shadow-card transition-all duration-300 text-center animate-fade-in`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`h-16 w-16 mx-auto rounded-2xl ${cuisine.color} flex items-center justify-center text-3xl mb-3 group-hover:scale-110 transition-transform`}>
                  {cuisine.emoji}
                </div>
                <span className="font-medium text-foreground">{cuisine.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Recipes */}
      <section className="py-16 section-gradient">
        <div className="container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl font-bold mb-2">Featured Recipes</h2>
              <p className="text-muted-foreground">Hand-picked favorites to inspire your next meal</p>
            </div>
            <Link to="/recipes">
              <Button variant="ghost" className="gap-2">
                See More <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <RecipeGrid recipes={FEATURED_RECIPES} />
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-16">
        <div className="container">
          <div className="bg-primary rounded-3xl p-8 md:p-12 text-primary-foreground text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Start Your Culinary Journey
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Join thousands of home cooks discovering new recipes, planning meals, 
              and enjoying stress-free grocery shopping.
            </p>
            <Link to="/recipes">
              <Button size="lg" variant="secondary" className="gap-2 h-12 px-8">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
