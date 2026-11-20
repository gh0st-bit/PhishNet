import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";

// Schema for the reset password form
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(16, { message: "Password cannot exceed 16 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [location] = useLocation();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Extract token from URL
  const token = location.split("/").pop() || "";
  
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormValues & { token: string }) => {
      const response = await apiRequest("POST", "/api/reset-password", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  function onSubmit(data: ResetPasswordFormValues) {
    setError(null);
    resetPasswordMutation.mutate({ ...data, token });
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {success ? "Password Reset Complete" : "Set New Password"}
          </CardTitle>
          <CardDescription className="text-center">
            {success 
              ? "Your password has been reset successfully" 
              : "Create a new secure password for your account"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!success ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="reset-new-password">New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            id="reset-new-password" type={showPassword ? "text" : "password"}
                            placeholder="••••••••" 
                            {...field} 
                            disabled={resetPasswordMutation.isPending}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="sr-only">
                              {showPassword ? "Hide password" : "Show password"}
                            </span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="reset-confirm-password">Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            id="reset-confirm-password" type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••" 
                            {...field} 
                            disabled={resetPasswordMutation.isPending}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="sr-only">
                              {showConfirmPassword ? "Hide password" : "Show password"}
                            </span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="text-xs text-muted-foreground space-y-1 mt-2">
                  <p>Password requirements:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>Between 8-16 characters</li>
                    <li>At least one uppercase letter</li>
                    <li>At least one lowercase letter</li>
                    <li>At least one number</li>
                    <li>At least one special character</li>
                  </ul>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center py-4">
              <p className="mb-4">
                Your password has been reset successfully. You can now login with your new password.
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center border-t p-4">
          <Link href="/auth" className="flex items-center text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {success ? "Go to login" : "Back to login"}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
