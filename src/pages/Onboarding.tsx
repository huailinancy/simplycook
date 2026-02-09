import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserPreferencesForm } from '@/components/user/UserPreferencesForm';
import { ChefHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Onboarding() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading, userProfile, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading) {
      // If not logged in, redirect to auth
      if (!user) {
        navigate('/auth');
        return;
      }
      // If already has profile, redirect to home
      if (userProfile) {
        navigate('/');
      }
    }
  }, [user, loading, userProfile, navigate]);

  const handleComplete = async (preferences: {
    allergies: string[];
    flavor_preferences: string[];
    diet_preferences: string[];
  }) => {
    setIsSubmitting(true);

    const { error } = await updateUserProfile({
      allergies: preferences.allergies,
      flavor_preferences: preferences.flavor_preferences,
      diet_preferences: preferences.diet_preferences,
    });

    if (error) {
      toast({
        title: 'Error saving preferences',
        description: error,
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: 'Welcome to SimplyCook!',
      description: 'Your preferences have been saved.',
    });

    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ChefHat className="h-8 w-8" />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">
            Let's personalize your experience
          </h1>
          <p className="text-muted-foreground">
            Tell us about your preferences so we can show you recipes you'll love
          </p>
        </div>

        <UserPreferencesForm onComplete={handleComplete} isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}
