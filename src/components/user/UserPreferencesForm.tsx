import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Heart, Utensils } from 'lucide-react';
import { ALLERGY_OPTIONS, FLAVOR_PREFERENCES, DIET_PREFERENCE_OPTIONS } from '@/types/recipe';
import { cn } from '@/lib/utils';

interface UserPreferencesFormProps {
  onComplete: (preferences: {
    allergies: string[];
    flavor_preferences: string[];
    diet_preferences: string[];
  }) => void;
  isSubmitting?: boolean;
}

export function UserPreferencesForm({ onComplete, isSubmitting }: UserPreferencesFormProps) {
  const [step, setStep] = useState(1);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [flavorPreferences, setFlavorPreferences] = useState<string[]>([]);
  const [dietPreferences, setDietPreferences] = useState<string[]>([]);

  const toggleItem = (item: string, list: string[], setList: (items: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete({
        allergies,
        flavor_preferences: flavorPreferences,
        diet_preferences: dietPreferences,
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                Select any allergies so we can filter recipes for you
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ALLERGY_OPTIONS.map((allergy) => (
                <div
                  key={allergy}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    allergies.includes(allergy)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => toggleItem(allergy, allergies, setAllergies)}
                >
                  <Checkbox
                    id={`allergy-${allergy}`}
                    checked={allergies.includes(allergy)}
                    onCheckedChange={() => toggleItem(allergy, allergies, setAllergies)}
                  />
                  <Label htmlFor={`allergy-${allergy}`} className="cursor-pointer flex-1">
                    {allergy}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-rose-500" />
              <p className="text-sm text-muted-foreground">
                What flavors do you enjoy?
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FLAVOR_PREFERENCES.map((flavor) => (
                <div
                  key={flavor}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    flavorPreferences.includes(flavor)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => toggleItem(flavor, flavorPreferences, setFlavorPreferences)}
                >
                  <Checkbox
                    id={`flavor-${flavor}`}
                    checked={flavorPreferences.includes(flavor)}
                    onCheckedChange={() => toggleItem(flavor, flavorPreferences, setFlavorPreferences)}
                  />
                  <Label htmlFor={`flavor-${flavor}`} className="cursor-pointer flex-1">
                    {flavor}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="h-5 w-5 text-herb" />
              <p className="text-sm text-muted-foreground">
                Any dietary preferences?
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DIET_PREFERENCE_OPTIONS.map((diet) => (
                <div
                  key={diet}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    dietPreferences.includes(diet)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => toggleItem(diet, dietPreferences, setDietPreferences)}
                >
                  <Checkbox
                    id={`diet-${diet}`}
                    checked={dietPreferences.includes(diet)}
                    onCheckedChange={() => toggleItem(diet, dietPreferences, setDietPreferences)}
                  />
                  <Label htmlFor={`diet-${diet}`} className="cursor-pointer flex-1">
                    {diet}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  const stepTitles = ['Allergies', 'Flavor Preferences', 'Dietary Preferences'];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                    ? "bg-herb text-herb-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "w-16 sm:w-24 h-1 mx-2 rounded",
                    step > s ? "bg-herb" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <CardTitle className="text-xl font-display">
          Step {step}: {stepTitles[step - 1]}
        </CardTitle>
        <CardDescription>
          {step === 1 && "Help us personalize your experience by telling us about any food allergies."}
          {step === 2 && "What kind of flavors make your taste buds happy?"}
          {step === 3 && "Let us know your dietary preferences for better recommendations."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderStep()}

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="btn-primary-gradient border-0"
          >
            {isSubmitting ? (
              'Saving...'
            ) : step === 3 ? (
              <>
                Complete Setup
                <Check className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
