import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { customToast } from "@/components/ui/custom-toast";

// Registration data with optional organization name
type RegistrationData = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
};

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<any, Error, RegistrationData>;
  forgotPasswordMutation: UseMutationResult<void, Error, { email: string }>;
  resetPasswordMutation: UseMutationResult<void, Error, { password: string, token: string }>;
  logout: () => Promise<void>;
};

type LoginData = Pick<InsertUser, "email" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      const data = await res.json();
      
      // Don't throw error if requiresTwoFactor or requiresTwoFactorSetup is returned
      if (data.requiresTwoFactor || data.requiresTwoFactorSetup) {
        return data;
      }
      
      return data;
    },
    onSuccess: async (data: any) => {
      // Only update cache and redirect if we have a full user object (not just 2FA flags)
      if (data.id && data.email) {
        // Ensure we have roles; if missing, fetch from /api/user to enrich
        let enriched = data;
        if (!Array.isArray(enriched.roles)) {
          try {
            const res = await apiRequest("GET", "/api/user");
            if (res.ok) {
              const userJson = await res.json();
              enriched = { ...enriched, ...userJson };
            }
          } catch {
            // ignore and proceed with available data
          }
        }

        // Update cache so /api/user query resolves immediately
        queryClient.setQueryData(["/api/user"], enriched);
        customToast.success({
          title: "Login successful",
          description: `Welcome back, ${enriched.firstName} ${enriched.lastName}!`,
        });
        
        // Redirect based on role precedence
        const roles: string[] = Array.isArray(enriched.roles) ? enriched.roles : [];
        const isGlobalAdmin = enriched.isAdmin || roles.includes("Admin");
        const isOrgAdmin = roles.includes("OrgAdmin") && !isGlobalAdmin;
        const isUser = roles.includes("User") || (!isGlobalAdmin && !isOrgAdmin);

        let redirectPath = "/"; // Admin dashboard by default
        if (isOrgAdmin) redirectPath = "/org-admin";
        else if (isUser && !isGlobalAdmin) redirectPath = "/employee";
        
        // Force a full reload to ensure session cookie is applied before protected route check
        // (avoids edge case where client-side navigation happens before browser commits cookie)
        window.location.replace(redirectPath);
      }
    },
    onError: (error: Error) => {
      let errorMessage = error.message;
      const attemptsMatch = error.message.match(/(\d+) attempts remaining/);
      const remainingAttempts = attemptsMatch ? attemptsMatch[1] : null;
      if (remainingAttempts) {
        errorMessage = `Invalid email or password. ${remainingAttempts} attempts remaining.`;
      }
      customToast.error({
        title: "Login failed",
        description: errorMessage,
      });
    },
  });

  // Using the RegistrationData type defined above
  
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegistrationData) => {
      console.log('Attempting registration:', {
        ...credentials,
        password: '[REDACTED]'
      });
      const res = await apiRequest("POST", "/api/register", credentials);
      const data = await res.json();
      console.log('Registration response:', data);
      return data;
    },
    onSuccess: (response) => {
      customToast.success({
        title: "Registration successful",
        description: "Please log in with your new account"
      });
    },
    onError: (error: Error) => {
      customToast.error({
        title: "Registration failed",
        description: error.message
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      customToast.success({
        title: "Logged out successfully",
      });
      // Force an immediate page navigation to auth page
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      customToast.error({
        title: "Logout failed",
        description: error.message
      });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      await apiRequest("POST", "/api/forgot-password", { email });
    },
    onSuccess: () => {
      customToast.success({
        title: "Password reset email sent",
        description: "If an account exists with this email, you will receive instructions to reset your password.",
      });
    },
    onError: (error: Error) => {
      customToast.error({
        title: "Request failed",
        description: "If an account exists with this email, you will receive instructions to reset your password."
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ password, token }: { password: string; token: string }) => {
      await apiRequest("POST", "/api/reset-password", { password, token });
    },
    onSuccess: () => {
      customToast.success({
        title: "Password reset successful",
        description: "Your password has been reset. You can now log in with your new password.",
      });
      navigate("/auth");
    },
    onError: (error: Error) => {
      customToast.error({
        title: "Password reset failed",
        description: error.message
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        forgotPasswordMutation,
        resetPasswordMutation,
        logout: () => logoutMutation.mutateAsync(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
