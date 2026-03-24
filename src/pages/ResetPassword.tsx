import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError(language === 'zh' ? '请填写所有字段' : 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError(language === 'zh' ? '密码至少需要6个字符' : 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError(language === 'zh' ? '两次输入的密码不一致' : 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
    }
    setIsSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-display">
              {language === 'zh' ? '密码已更新' : 'Password Updated'}
            </CardTitle>
            <CardDescription className="text-base">
              {language === 'zh' ? '您的密码已成功修改' : 'Your password has been successfully changed'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>
              {language === 'zh' ? '返回首页' : 'Go to Home'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Lock className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display">
            {language === 'zh' ? '设置新密码' : 'Set New Password'}
          </CardTitle>
          <CardDescription>
            {language === 'zh' ? '请输入您的新密码' : 'Enter your new password below'}
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
              <Label htmlFor="new-password">
                {language === 'zh' ? '新密码' : 'New Password'}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {language === 'zh' ? '确认密码' : 'Confirm Password'}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button type="submit" className="w-full btn-primary-gradient border-0" disabled={isSubmitting}>
              {isSubmitting
                ? (language === 'zh' ? '请稍候...' : 'Please wait...')
                : (language === 'zh' ? '更新密码' : 'Update Password')
              }
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="text-sm text-primary hover:underline"
            >
              {language === 'zh' ? '返回登录' : 'Back to Sign In'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
