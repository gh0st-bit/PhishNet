import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Link, useLocation } from "wouter";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { TwoFactorVerificationDialog } from '@/components/security/two-factor-verification-dialog';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { customToast } from "@/components/ui/custom-toast";
import { Logo } from "@/components/common/logo";
import { queryClient } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(16, "Password cannot exceed 16 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
  organizationName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoOrgId, setSsoOrgId] = useState<number | null>(null);
  const [checkingSso, setCheckingSso] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      organizationName: "",
    },
  });

  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorSetupRequired, setTwoFactorSetupRequired] = useState(false);
  
  async function onLoginSubmit(data: LoginFormValues) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: data.email, password: data.password })
      });
      
      const body = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        customToast.error({ title: 'Login Failed', description: body.message || 'Please check your credentials and try again' });
        return;
      }
      
      // Handle 2FA setup requirement
      if (body.requiresTwoFactorSetup) {
        setTwoFactorSetupRequired(true);
        customToast.info({ title: 'Two-Factor Setup Required', description: 'Scan the QR code and then enter a 6-digit code to activate 2FA.' });
        return;
      }
      
      // Handle 2FA verification requirement
      if (body.requiresTwoFactor) {
        setTwoFactorPending(true);
        customToast.info({ title: 'Two-Factor Verification', description: 'Enter the current 6-digit code from your authenticator app to continue.' });
        return;
      }
      
      // Handle successful login without 2FA
      if (body.id && body.email) {
        customToast.success({ 
          title: 'Login Successful', 
          description: `Welcome back, ${body.firstName} ${body.lastName}!` 
        });
        
        // Invalidate and refetch user data, then navigate
        await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        
        // Small delay to ensure session cookie is set
        setTimeout(() => {
          window.location.href = '/';
        }, 300);
      } else {
        customToast.error({ title: 'Login Failed', description: 'Unexpected response from server' });
      }
    } catch (err: any) {
      customToast.error({ title: 'Login Failed', description: err.message || 'Unexpected error' });
    }
  }

  async function checkSsoForEmail(email: string) {
    if (!email?.includes('@')) return;
    
    setCheckingSso(true);
    try {
      const res = await fetch(`/api/sso/check/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.enabled && data.organizationId) {
        setSsoEnabled(true);
        setSsoOrgId(data.organizationId);
      } else {
        setSsoEnabled(false);
        setSsoOrgId(null);
      }
    } catch (e: unknown) {
      setSsoEnabled(false);
      setSsoOrgId(null);
    } finally {
      setCheckingSso(false);
    }
  }

  function handleSsoLogin() {
    if (ssoOrgId) {
      globalThis.location.href = `/api/auth/saml/${ssoOrgId}`;
    }
  }
  
  // We'll no longer display the error directly in the form
  // const loginErrorMessage = loginMutation.error?.message;

  function onRegisterSubmit(data: RegisterFormValues) {
    // Prepare data for submission
    const registrationData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      // Only include organizationName if it's not empty
      ...(data.organizationName ? { organizationName: data.organizationName } : {})
      // Note: isAdmin is now handled on the server based on whether this is the first user
    };
    
    registerMutation.mutate(registrationData, {
      onSuccess: (response) => {
        // Show success toast
        customToast.success({
          title: "Registration Successful",
          description: `Welcome to PhishNet, ${data.firstName}! Please log in with your credentials.`
        });
        
        // Reset the form
        registerForm.reset();
        
        // Switch to the login tab
        const loginTab = document.querySelector('[data-state="inactive"][value="login"]') as HTMLElement;
        if (loginTab) loginTab.click();
        
        // Pre-fill the email field for convenience
        loginForm.setValue('email', data.email);
      },
      onError: (error) => {
        // Show error toast
        customToast.error({
          title: "Registration Failed",
          description: error.message || "Please check your information and try again"
        });
      }
    });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left column: Auth forms */}
      <div className="flex flex-1 items-center justify-center p-5">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <div className="flex flex-col items-center">
              <Logo className="h-20 w-20 mb-2" />
              <span className="text-2xl font-bold text-foreground">PhishNet</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 tabs-list">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardContent className="pt-6">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="email@company.com" 
                                {...field}
                                onBlur={(e) => {
                                  field.onBlur();
                                  checkSsoForEmail(e.target.value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  type={showLoginPassword ? "text" : "password"} 
                                  placeholder="•••••••" 
                                  {...field} 
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                              >
                                {showLoginPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="sr-only">
                                  {showLoginPassword ? "Hide password" : "Show password"}
                                </span>
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex items-center justify-between">
                        <FormField
                          control={loginForm.control}
                          name="rememberMe"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <Label htmlFor="rememberMe" className="text-sm text-muted-foreground">
                                Remember me
                              </Label>
                            </FormItem>
                          )}
                        />

                        <Link href="/forgot-password">
                          <Button variant="link" size="sm" className="px-0">
                            Forgot password?
                          </Button>
                        </Link>
                      </div>

                      {/* Error message now shown with custom toast */}
                      
                      {ssoEnabled && (
                        <div className="space-y-3">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">
                                Or continue with
                              </span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={handleSsoLogin}
                            disabled={checkingSso}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Sign in with SSO
                          </Button>
                        </div>
                      )}
                      
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={twoFactorPending}
                      >
                        {twoFactorPending ? "Awaiting 2FA..." : "Sign in"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardContent className="pt-6">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Smith" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="email@company.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  type={showRegisterPassword ? "text" : "password"} 
                                  placeholder="•••••••" 
                                  {...field} 
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              >
                                {showRegisterPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="sr-only">
                                  {showRegisterPassword ? "Hide password" : "Show password"}
                                </span>
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  type={showRegisterPassword ? "text" : "password"} 
                                  placeholder="•••••••" 
                                  {...field} 
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Alert className="bg-muted">
                        <Shield className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Password must be 8-16 characters and include uppercase, lowercase, 
                          number, and special character.
                        </AlertDescription>
                      </Alert>

                      <FormField
                        control={registerForm.control}
                        name="organizationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Name (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme Inc. (leave empty for no organization)" {...field} />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Organization is optional. Creating or joining an organization gives you access to team features.
                              The first user of a new organization will be set as admin. Leave empty if you're an individual user.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating account..." : "Create account"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <TwoFactorVerificationDialog 
          open={twoFactorPending} 
          onClose={() => setTwoFactorPending(false)}
          onSuccess={async () => {
            setTwoFactorPending(false);
            customToast.success({ title: 'Login Complete', description: '2FA verified.' });
            
            // Invalidate queries and wait a moment for session
            await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
            
            // Navigate after small delay
            setTimeout(() => {
              window.location.href = '/';
            }, 300);
          }}
        />
      </div>

      {/* Right column: Hero section */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center bg-card p-12">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-6 text-foreground">
            Strengthen Your Security Defenses with PhishNet
          </h1>
          <p className="text-lg mb-8 text-muted-foreground">
            The complete platform for cybersecurity awareness and phishing simulation. Train your team, test your defenses, and track progress with detailed analytics.
          </p>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="mt-1 bg-primary/20 p-1 rounded-full">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Realistic Phishing Campaigns</h3>
                <p className="text-sm text-muted-foreground">Create targeted phishing scenarios that mimic real-world threats.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="mt-1 bg-primary/20 p-1 rounded-full">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Detailed Analytics</h3>
                <p className="text-sm text-muted-foreground">Monitor progress with comprehensive reporting and actionable insights.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="mt-1 bg-primary/20 p-1 rounded-full">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Security Training</h3>
                <p className="text-sm text-muted-foreground">Turn security vulnerabilities into learning opportunities for your team.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
