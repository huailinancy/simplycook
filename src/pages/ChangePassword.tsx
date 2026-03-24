import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, signIn, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(language === 'zh' ? '请填写所有字段' : 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError(language === 'zh' ? '新密码至少需要6个字符' : 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(language === 'zh' ? '两次输入的新密码不一致' : 'New passwords do not match');
      return;
    }

    setIsSubmitting(true);

    // Verify current password by re-signing in
    const { error: signInError } = await signIn(user.email!, currentPassword);
    if (signInError) {
      setError(language === 'zh' ? '当前密码不正确' : 'Current password is incorrect');
      setIsSubmitting(false);
      return;
    }

    // Update to new password
    const { error: updateError } = await updatePassword(newPassword);
    if (updateError) {
      setError(updateError);
    } else {
      setSuccess(true);
    }
    setIsSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-display">
                {language === 'zh' ? '密码已修改' : 'Password Changed'}
              </CardTitle>
              <CardDescription className="text-base">
                {language === 'zh' ? '您的密码已成功更新' : 'Your password has been successfully updated'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/')}>
                {language === 'zh' ? '返回首页' : 'Go to Home'}
              </Button>
            </CardContent>
          </Card>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4 pb-20 md:pb-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-xl font-display">
                {language === 'zh' ? '修改密码' : 'Change Password'}
              </CardTitle>
            </div>
            <CardDescription>
              {language === 'zh' ? '请输入当前密码和新密码' : 'Enter your current password and a new password'}
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
                <Label htmlFor="current-password">
                  {language === 'zh' ? '当前密码' : 'Current Password'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="current-password"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

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
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  {language === 'zh' ? '确认新密码' : 'Confirm New Password'}
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
                  : (language === 'zh' ? '确认修改' : 'Update Password')
                }
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <MobileBottomNav />
    </div>
  );
}
