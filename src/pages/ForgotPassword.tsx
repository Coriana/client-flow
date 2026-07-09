import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Forgot your password?</CardTitle>
          <CardDescription>
            Password resets are handled by your administrator. Please contact them to have your
            password reset.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col space-y-4">
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign in
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
