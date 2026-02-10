import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Mail, Lock, AlertCircle, CheckCircle2, Bookmark, Import, Heart, Globe } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, resetPassword, user, loading, needsOnboarding } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && user) {
      if (needsOnboarding) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
    }
  }, [user, loading, navigate, needsOnboarding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (isForgotPassword) {
      if (!email) {
        setError('Please enter your email address');
        setIsSubmitting(false);
        return;
      }
      const { error } = await resetPassword(email);
      if (error) {
        setError(error);
      } else {
        setResetSent(true);
      }
      setIsSubmitting(false);
      return;
    }

    if (!email || !password) {
      setError('Please fill in all fields');
      setIsSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsSubmitting(false);
      return;
    }

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error);
      } else {
        setSignupSuccess(true);
      }
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show success message after signup
  if (signupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-display">
              Account Created!
            </CardTitle>
            <CardDescription className="text-base">
              We've sent a confirmation link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Next steps:</AlertTitle>
              <AlertDescription className="text-green-700">
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Check your email inbox</li>
                  <li>Click the confirmation link</li>
                  <li>Set up your food preferences</li>
                  <li>Start discovering recipes!</li>
                </ol>
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground text-center">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                type="button"
                onClick={() => {
                  setSignupSuccess(false);
                  setEmail('');
                  setPassword('');
                }}
                className="text-primary hover:underline font-medium"
              >
                try again
              </button>
            </p>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSignupSuccess(false);
                  setIsLogin(true);
                }}
              >
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-8 items-stretch">
        {/* Login Form */}
        <Card className="w-full lg:w-1/2">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ChefHat className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="text-2xl font-display">
              {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? t('auth.signInAccess')
                : t('auth.registerAccess')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full btn-primary-gradient border-0"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Please wait...'
                  : isLogin ? t('auth.signIn') : t('auth.createAccount')
                }
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? t('auth.noAccount') + ' ' : t('auth.haveAccount') + ' '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? t('auth.signUp') : t('auth.signIn').toLowerCase()}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Explanation Panel */}
        <Card className="w-full lg:w-1/2 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-xl font-display">
              {t('auth.whySignIn')}
            </CardTitle>
            <CardDescription>
              {t('auth.unlockFeatures')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bookmark className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.saveRecipes')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('auth.saveRecipesDesc')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Import className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.importRecipes')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('auth.importRecipesDesc')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.shareRecipes')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('auth.shareRecipesDesc')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.personalized')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('auth.personalizedDesc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
