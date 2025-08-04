'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-auth';
import { updatePassword, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function SettingsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const { settings, setSettings } = useSettings();
  const router = useRouter();
  const { toast } = useToast();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Passwords do not match.',
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }
    setLoading(true);
    try {
      await updatePassword(user, newPassword);
      toast({
        title: 'Success',
        description: 'Your password has been updated.',
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating password',
        description: 'This operation is sensitive and requires recent authentication. Please log in again before retrying.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (authLoading || !settings) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Map
        </Button>
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Display Settings</CardTitle>
              <CardDescription>Customize units and coordinate formats.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Units</Label>
                <RadioGroup
                  value={settings.units}
                  onValueChange={(value) => setSettings({ ...settings, units: value as 'metric' | 'imperial' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="metric" id="metric" />
                    <Label htmlFor="metric">Metric (meters)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="imperial" id="imperial" />
                    <Label htmlFor="imperial">Imperial (feet)</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Coordinate Format</Label>
                <RadioGroup
                  value={settings.coordFormat}
                  onValueChange={(value) => setSettings({ ...settings, coordFormat: value as 'decimal' | 'dms' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="decimal" id="decimal" />
                    <Label htmlFor="decimal">Decimal Degrees (e.g., 40.7128)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dms" id="dms" />
                    <Label htmlFor="dms">Degrees, Minutes, Seconds (e.g., 40° 42' 46" N)</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account settings. You are logged in as {user?.email}.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <h3 className="font-semibold">Change Password</h3>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6">
              <Button variant="outline" onClick={handleLogout}>Log Out</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
