'use client';

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useAuth, signInWithGoogle } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true)
      await signInWithGoogle()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: error.message || 'An error occurred while signing in',
      })
      setSigningIn(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome to Map Explorer</CardTitle>
          <p className="text-center text-muted-foreground">Sign in to start creating and sharing maps</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleGoogleSignIn}
            className="w-full"
            size="lg"
            disabled={signingIn}
          >
            {signingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Continue with Google'
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Powered by Supabase Authentication
          </p>
        </CardContent>
      </Card>
    </div>
  )
}