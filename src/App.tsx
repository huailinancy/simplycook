import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SavedRecipesProvider } from "@/contexts/SavedRecipesContext";
import { MealPlanProvider } from "@/contexts/MealPlanContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Recipes from "./pages/Recipes";
import MealPlanner from "./pages/MealPlanner";
import GroceryList from "./pages/GroceryList";
import NotFound from "./pages/NotFound";
import RecipeDetail from "./pages/RecipeDetail";
import Onboarding from "./pages/Onboarding";
import SavedRecipes from "./pages/SavedRecipes";
import MyRecipes from "./pages/MyRecipes";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

// App root component
const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SavedRecipesProvider>
              <MealPlanProvider>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<Index />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/recipe/:id" element={<RecipeDetail />} />
              <Route path="/meal-planner" element={<MealPlanner />} />
              <Route path="/grocery-list" element={<GroceryList />} />
              <Route path="/saved" element={<SavedRecipes />} />
              <Route path="/my-recipes" element={<MyRecipes />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
              </MealPlanProvider>
            </SavedRecipesProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
