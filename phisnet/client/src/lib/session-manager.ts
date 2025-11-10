import { refreshSession } from "./queryClient";

// Session timeout in milliseconds (30 minutes)
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Time before session expiration to show warning (2 minutes before)
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // 2 minutes

// Event for communicating with components
export const SESSION_EVENTS = {
  TIMEOUT_WARNING: 'session-timeout-warning',
  SESSION_EXPIRED: 'session-expired'
};

let activityTimer: NodeJS.Timeout | null = null;
let warningTimer: NodeJS.Timeout | null = null;
let lastActivityTime: number = Date.now();
let warningEmitted: boolean = false;
let isAuthenticated = true;
let throttleTimer: NodeJS.Timeout | null = null;

// Define throttledTrackActivity at module level so it can be accessed in cleanup
const throttledTrackActivity = () => {
  if (throttleTimer) return;
  throttleTimer = setTimeout(() => {
    trackActivity();
    throttleTimer = null;
  }, 1000); // Throttle to once per second
};

/**
 * Tracks user activity and refreshes the session
 */
export function trackActivity() {
  if (!isAuthenticated) return;
  
  lastActivityTime = Date.now();
  warningEmitted = false;
  
  // Clear existing timers
  if (activityTimer) {
    clearTimeout(activityTimer);
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
  }
  
  // Set warning timer (28 minutes after activity - 2 minutes before expiry)
  warningTimer = setTimeout(() => {
    if (!warningEmitted && isAuthenticated) {
      warningEmitted = true;
      const warningEvent = new CustomEvent(SESSION_EVENTS.TIMEOUT_WARNING, {
        detail: { timeRemaining: WARNING_BEFORE_TIMEOUT }
      });
      document.dispatchEvent(warningEvent);
    }
  }, SESSION_TIMEOUT - WARNING_BEFORE_TIMEOUT);
  
  // Set session expiration timer (30 minutes after activity)
  activityTimer = setTimeout(() => {
    if (isAuthenticated) {
      // Emit session expired event
      const expiredEvent = new Event(SESSION_EVENTS.SESSION_EXPIRED);
      document.dispatchEvent(expiredEvent);
      
      // Force logout after a short delay
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1000);
    }
  }, SESSION_TIMEOUT);
  
  // Ping server to refresh session (but not too frequently)
  const now = Date.now();
  const lastPing = sessionStorage.getItem('lastSessionPing');
  // On first load (no lastPing), skip the immediate ping since login just established the session
  // Otherwise, only ping if more than 5 minutes have passed
  if (lastPing && now - parseInt(lastPing) > 5 * 60 * 1000) { // 5 minutes
    refreshSession();
  } else if (!lastPing) {
    // Mark initial session time without pinging (login just established the session)
    sessionStorage.setItem('lastSessionPing', now.toString());
  }
}

/**
 * Initialize session management
 */
export function initSessionManager() {
  console.log('Initializing session manager with 30-minute timeout');
  isAuthenticated = true;
  
  // Events to track user activity
  const events = [
    'mousedown', 'mousemove', 'keypress', 
    'scroll', 'touchstart', 'click', 'keydown'
  ];
  
  // Add event listeners
  events.forEach(event => {
    document.addEventListener(event, throttledTrackActivity, { passive: true });
  });
  
  // Initialize first activity tracking
  trackActivity();
  
  console.log('Session management initialized successfully');
}

/**
 * Cleanup session management
 */
export function cleanupSessionManager() {
  console.log('Cleaning up session manager');
  isAuthenticated = false;
  
  // Clear timers
  if (activityTimer) {
    clearTimeout(activityTimer);
    activityTimer = null;
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
  
  // Remove event listeners
  const events = [
    'mousedown', 'mousemove', 'keypress', 
    'scroll', 'touchstart', 'click', 'keydown'
  ];
  
  events.forEach(event => {
    document.removeEventListener(event, throttledTrackActivity);
  });
  
  console.log('Session management cleaned up');
}

/**
 * Force logout and cleanup
 */
export function forceLogout() {
  console.log('Forcing logout');
  cleanupSessionManager();
  window.location.href = '/auth';
}

/**
 * Extend session when user chooses to continue
 */
export function extendSession() {
  console.log('Extending session for another 30 minutes');
  warningEmitted = false;
  trackActivity();
}