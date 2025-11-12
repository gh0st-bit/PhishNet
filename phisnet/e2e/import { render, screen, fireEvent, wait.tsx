import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthPage from './auth-page';
import * as useAuthModule from '@/hooks/use-auth';
import { customToast } from '@/components/ui/custom-toast';

// Mock the useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  useAuth: mockUseAuth,
}));

// Mock wouter router
const mockNavigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/', mockNavigate],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock custom toast
vi.mock('@/components/ui/custom-toast', () => ({
  customToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Logo component
vi.mock('@/components/common/logo', () => ({
  Logo: ({ className, alt }: { className?: string; alt?: string }) => (
    <img src="mocked-logo.png" alt={alt || "PhishNet Logo"} className={className} />
  ),
}));

describe('AuthPage', () => {
  let queryClient: QueryClient;
  const mockLoginMutation = {
    mutate: vi.fn(),
    isPending: false,
    error: null,
  };
  const mockRegisterMutation = {
    mutate: vi.fn(),
    isPending: false,
    error: null,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseAuth.mockReturnValue({
      user: null,
      loginMutation: mockLoginMutation,
      registerMutation: mockRegisterMutation,
    });

    vi.clearAllMocks();
  });

  const renderAuthPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthPage />
      </QueryClientProvider>
    );
  };

  describe('Component Rendering', () => {
    test('renders login form by default', () => {
      renderAuthPage();
      
      expect(screen.getByText('PhishNet')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('email@company.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('•••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    test('renders hero section with features', () => {
      renderAuthPage();
      
      expect(screen.getByText('Strengthen Your Security Defenses with PhishNet')).toBeInTheDocument();
      expect(screen.getByText('Realistic Phishing Campaigns')).toBeInTheDocument();
      expect(screen.getByText('Detailed Analytics')).toBeInTheDocument();
      expect(screen.getByText('Security Training')).toBeInTheDocument();
    });

    test('switches to register tab when clicked', () => {
      renderAuthPage();
      
      fireEvent.click(screen.getByText('Register'));
      
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Smith')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });
  });

  describe('User Redirection', () => {
    test('redirects authenticated user to dashboard', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'test@example.com' },
        loginMutation: mockLoginMutation,
        registerMutation: mockRegisterMutation,
      });

      renderAuthPage();

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Login Form', () => {
    test('validates required email field', async () => {
      renderAuthPage();
      
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    test('submits login form with valid data', async () => {
      renderAuthPage();
      
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const passwordInput = screen.getByPlaceholderText('•••••••');
      const rememberMeCheckbox = screen.getByLabelText('Remember me');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(rememberMeCheckbox);
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockLoginMutation.mutate).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        }, expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }));
      });
    });

    test('toggles password visibility', () => {
      renderAuthPage();
      
      const passwordInput = screen.getByPlaceholderText('•••••••');
      const toggleButton = screen.getByLabelText('Show password');
      
      expect(passwordInput).toHaveAttribute('type', 'password');
      
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText('Hide password')).toBeInTheDocument();
    });

    test('shows loading state during login', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loginMutation: { ...mockLoginMutation, isPending: true },
        registerMutation: mockRegisterMutation,
      });

      renderAuthPage();
      
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled();
    });

    test('handles login success with toast', async () => {
      renderAuthPage();
      
      // Simulate successful login
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const passwordInput = screen.getByPlaceholderText('•••••••');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
      
      // Get the onSuccess callback and call it
      const mutateCall = mockLoginMutation.mutate.mock.calls[0];
      const callbacks = mutateCall[1];
      callbacks.onSuccess();
      
      expect(customToast.success).toHaveBeenCalledWith({
        title: 'Login Successful',
        description: 'Welcome back to PhishNet',
      });
    });

    test('handles login error with toast', async () => {
      renderAuthPage();
      
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const passwordInput = screen.getByPlaceholderText('•••••••');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);
      
      // Simulate error
      const mutateCall = mockLoginMutation.mutate.mock.calls[0];
      const callbacks = mutateCall[1];
      callbacks.onError({ message: 'Invalid credentials' });
      
      expect(customToast.error).toHaveBeenCalledWith({
        title: 'Login Failed',
        description: 'Invalid credentials',
      });
    });
  });

  describe('Registration Form', () => {
    beforeEach(() => {
      renderAuthPage();
      fireEvent.click(screen.getByText('Register'));
    });

    test('renders all registration fields', () => {
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Smith')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('email@company.com')).toBeInTheDocument();
      expect(screen.getAllByPlaceholderText('•••••••')).toHaveLength(2);
      expect(screen.getByPlaceholderText('Acme Inc. (leave empty for no organization)')).toBeInTheDocument();
    });

    test('validates required fields', async () => {
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('First name is required')).toBeInTheDocument();
        expect(screen.getByText('Last name is required')).toBeInTheDocument();
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    test('validates password requirements', async () => {
      const passwordInput = screen.getAllByPlaceholderText('•••••••')[0];
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      // Test weak password
      fireEvent.change(passwordInput, { target: { value: 'weak' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
      
      // Test password without uppercase
      fireEvent.change(passwordInput, { target: { value: 'password123!' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one uppercase letter')).toBeInTheDocument();
      });
    });

    test('validates password confirmation match', async () => {
      const firstNameInput = screen.getByPlaceholderText('John');
      const lastNameInput = screen.getByPlaceholderText('Smith');
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const passwordInput = screen.getAllByPlaceholderText('•••••••')[0];
      const confirmPasswordInput = screen.getAllByPlaceholderText('•••••••')[1];
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123!' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    test('submits registration form with valid data', async () => {
      const firstNameInput = screen.getByPlaceholderText('John');
      const lastNameInput = screen.getByPlaceholderText('Smith');
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const passwordInput = screen.getAllByPlaceholderText('•••••••')[0];
      const confirmPasswordInput = screen.getAllByPlaceholderText('•••••••')[1];
      const organizationInput = screen.getByPlaceholderText('Acme Inc. (leave empty for no organization)');
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });
      fireEvent.change(organizationInput, { target: { value: 'Test Corp' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockRegisterMutation.mutate).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Password123!',
          organizationName: 'Test Corp',
        }, expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }));
      });
    });

    test('submits registration without organization name', async () => {
      const firstNameInput = screen.getByPlaceholderText('John');
      const lastNameInput = screen.getByPlaceholderText('Smith');
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const passwordInput = screen.getAllByPlaceholderText('•••••••')[0];
      const confirmPasswordInput = screen.getAllByPlaceholderText('•••••••')[1];
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockRegisterMutation.mutate).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Password123!',
        }, expect.any(Object));
      });
    });

    test('shows loading state during registration', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loginMutation: mockLoginMutation,
        registerMutation: { ...mockRegisterMutation, isPending: true },
      });

      // Re-render with new mock
      renderAuthPage();
      fireEvent.click(screen.getByText('Register'));
      
      expect(screen.getByRole('button', { name: /creating account.../i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating account.../i })).toBeDisabled();
    });

    test('handles registration success', async () => {
      const firstNameInput = screen.getByPlaceholderText('John');
      const emailInput = screen.getByPlaceholderText('email@company.com');
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      // Fill out minimal form
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(screen.getByPlaceholderText('Smith'), { target: { value: 'Doe' } });
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
      fireEvent.change(screen.getAllByPlaceholderText('•••••••')[0], { target: { value: 'Password123!' } });
      fireEvent.change(screen.getAllByPlaceholderText('•••••••')[1], { target: { value: 'Password123!' } });
      fireEvent.click(submitButton);
      
      // Simulate success
      const mutateCall = mockRegisterMutation.mutate.mock.calls[0];
      const callbacks = mutateCall[1];
      callbacks.onSuccess({});
      
      expect(customToast.success).toHaveBeenCalledWith({
        title: 'Registration Successful',
        description: 'Welcome to PhishNet, John! Please log in with your credentials.',
      });
    });

    test('handles registration error', async () => {
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      // Fill out form and submit
      fireEvent.change(screen.getByPlaceholderText('John'), { target: { value: 'John' } });
      fireEvent.change(screen.getByPlaceholderText('Smith'), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByPlaceholderText('email@company.com'), { target: { value: 'john@example.com' } });
      fireEvent.change(screen.getAllByPlaceholderText('•••••••')[0], { target: { value: 'Password123!' } });
      fireEvent.change(screen.getAllByPlaceholderText('•••••••')[1], { target: { value: 'Password123!' } });
      fireEvent.click(submitButton);
      
      // Simulate error
      const mutateCall = mockRegisterMutation.mutate.mock.calls[0];
      const callbacks = mutateCall[1];
      callbacks.onError({ message: 'Email already exists' });
      
      expect(customToast.error).toHaveBeenCalledWith({
        title: 'Registration Failed',
        description: 'Email already exists',
      });
    });

    test('toggles password visibility in registration', () => {
      const passwordInputs = screen.getAllByPlaceholderText('•••••••');
      const toggleButtons = screen.getAllByLabelText('Show password');
      
      expect(passwordInputs[0]).toHaveAttribute('type', 'password');
      expect(passwordInputs[1]).toHaveAttribute('type', 'password');
      
      fireEvent.click(toggleButtons[0]);
      expect(passwordInputs[0]).toHaveAttribute('type', 'text');
      expect(passwordInputs[1]).toHaveAttribute('type', 'text'); // Both share same state
    });

    test('displays password requirements alert', () => {
      expect(screen.getByText('Password must be 8-16 characters and include uppercase, lowercase, number, and special character.')).toBeInTheDocument();
    });

    test('displays organization description', () => {
      expect(screen.getByText(/Organization is optional/)).toBeInTheDocument();
      expect(screen.getByText(/The first user of a new organization will be set as admin/)).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    test('renders forgot password link', () => {
      renderAuthPage();
      
      const forgotPasswordLink = screen.getByText('Forgot password?');
      expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '/forgot-password');
    });
  });

  describe('Password Length Validation', () => {
    test('validates maximum password length', async () => {
      renderAuthPage();
      fireEvent.click(screen.getByText('Register'));
      
      const passwordInput = screen.getAllByPlaceholderText('•••••••')[0];
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      // Test password exceeding 16 characters
      fireEvent.change(passwordInput, { target: { value: 'VeryLongPassword123456!' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Password cannot exceed 16 characters')).toBeInTheDocument();
      });
    });

    test('validates special character requirement', async () => {
      renderAuthPage();
      fireEvent.click(screen.getByText('Register'));
      
      const passwordInput = screen.getAllByPlaceholderText('•••••••')[0];
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      // Test password without special character
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one special character')).toBeInTheDocument();
      });
    });
  });
});