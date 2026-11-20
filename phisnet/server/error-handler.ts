import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import fs from 'fs';
import path from 'path';

interface ErrorLog {
  timestamp: string;
  error: string;
  stack?: string;
  request: {
    method: string;
    url: string;
    body?: any;
    user?: any;
  };
  solution?: string;
}

class ErrorHandler {
  private errorLogPath: string;
  private errorHistory: ErrorLog[] = [];

  constructor() {
    this.errorLogPath = path.join(process.cwd(), 'logs', 'error-log.json');
    this.ensureLogDirectory();
    this.loadErrorHistory();
  }

  private ensureLogDirectory() {
    const logDir = path.dirname(this.errorLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private loadErrorHistory() {
    try {
      if (fs.existsSync(this.errorLogPath)) {
        const data = fs.readFileSync(this.errorLogPath, 'utf-8');
        this.errorHistory = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Could not load error history:', error);
      this.errorHistory = [];
    }
  }

  private saveErrorHistory() {
    try {
      fs.writeFileSync(this.errorLogPath, JSON.stringify(this.errorHistory, null, 2));
    } catch (error) {
      console.error('Could not save error history:', error);
    }
  }

  private getSuggestedSolution(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    
    // Common TypeScript/Runtime error patterns and solutions
    if (errorMessage.includes('user') && errorMessage.includes('undefined')) {
      return 'Add assertUser(req.user) after isAuthenticated middleware';
    }
    
    if (errorMessage.includes('organizationid') && errorMessage.includes('not exist')) {
      return 'Use organization_id instead of organizationId for database fields';
    }
    
    if (errorMessage.includes('missing') && errorMessage.includes('property')) {
      return 'Add missing required properties to the object being passed';
    }
    
    if (errorMessage.includes('validation error')) {
      return 'Check request body schema and ensure all required fields are provided';
    }
    
    if (errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
      return 'User does not have permission to access this resource';
    }
    
    if (errorMessage.includes('not found')) {
      return 'Check if the requested resource exists and user has access';
    }

    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      return 'Check database connection and query syntax';
    }

    return 'Check the error stack trace for more details';
  }

  private logError(error: Error, req: Request): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      request: {
        method: req.method,
        url: req.path,
        body: undefined,
        user: req.user ? { id: req.user.id, email: req.user.email } : undefined
      },
      solution: this.getSuggestedSolution(error)
    };

    this.errorHistory.push(errorLog);
    
    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }
    
    this.saveErrorHistory();
    
    // Log to console with solution
    console.error('🚨 Runtime Error Detected:');
    console.error('Error:', error.message);
    console.error('💡 Suggested Solution:', errorLog.solution);
    console.error('Request:', `${req.method} ${req.path}`);
    console.error('---');
  }

  // Express error middleware
  middleware = (error: Error, req: Request, res: Response, next: NextFunction) => {
    this.logError(error, req);
    const requestStatus=Number((error as any).status||(error as any).statusCode);
    if(Number.isInteger(requestStatus)&&requestStatus>=400&&requestStatus<500)return res.status(requestStatus).json({message:error.message});

    // Handle different types of errors
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.issues,
        solution: 'Check request body schema and ensure all required fields are provided'
      });
    }

    if (error.message.includes('user') && error.message.includes('undefined')) {
      return res.status(401).json({
        message: 'User not authenticated',
        solution: 'Please log in again'
      });
    }

    if (error.message.includes('Access denied') || error.message.includes('forbidden')) {
      return res.status(403).json({
        message: 'Access denied',
        solution: 'You do not have permission to access this resource'
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        message: 'Resource not found',
        solution: 'Check if the requested resource exists'
      });
    }

    // Generic server error
    res.status(500).json({
      message: 'Internal server error',
      solution: this.getSuggestedSolution(error),
    });
  };

  // Get error statistics
  getErrorStats() {
    const last24Hours = this.errorHistory.filter(
      log => new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const errorCounts = this.errorHistory.reduce((acc, log) => {
      const errorType = log.error.split(':')[0] || 'Unknown';
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: this.errorHistory.length,
      last24Hours: last24Hours.length,
      commonErrors: errorCounts,
      recentErrors: this.errorHistory.slice(-10)
    };
  }

  // Clear error history
  clearHistory() {
    this.errorHistory = [];
    this.saveErrorHistory();
  }
}

export const errorHandler = new ErrorHandler();

// User assertion helper with better error handling
export function assertUser(user: any): asserts user is { id: number; email: string; organizationId: number } {
  if (!user) {
    const error = new Error('User not authenticated - please log in again');
    throw error;
  }
  
  if (!user.id || !user.email || !user.organizationId) {
    const error = new Error('Invalid user session - missing required user data');
    throw error;
  }
}

// Database field mapping helper to prevent organizationId vs organization_id errors
export function mapDatabaseFields<T extends Record<string, any>>(obj: T): T {
  const mapped = { ...obj };
  
  // Common field mappings
  if ('organizationId' in mapped && !('organization_id' in mapped)) {
    (mapped as any).organization_id = mapped.organizationId;
  }
  
  if ('createdAt' in mapped && !('created_at' in mapped)) {
    (mapped as any).created_at = mapped.createdAt;
  }
  
  if ('updatedAt' in mapped && !('updated_at' in mapped)) {
    (mapped as any).updated_at = mapped.updatedAt;
  }

  return mapped;
}
