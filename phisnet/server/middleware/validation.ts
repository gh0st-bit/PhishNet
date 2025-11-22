import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Express middleware for validating request bodies using Zod schemas
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateBody(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and parse request body
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors for client
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        
        return res.status(400).json({
          message: "Validation failed",
          errors,
        });
      }
      
      // Handle unexpected errors
      console.error("Validation middleware error:", error);
      return res.status(500).json({
        message: "Internal server error during validation",
      });
    }
  };
}

/**
 * Express middleware for validating query parameters using Zod schemas
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and parse query parameters
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        
        return res.status(400).json({
          message: "Query validation failed",
          errors,
        });
      }
      
      console.error("Query validation middleware error:", error);
      return res.status(500).json({
        message: "Internal server error during query validation",
      });
    }
  };
}

/**
 * Express middleware for validating route parameters using Zod schemas
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateParams(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and parse route parameters
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        
        return res.status(400).json({
          message: "Parameter validation failed",
          errors,
        });
      }
      
      console.error("Parameter validation middleware error:", error);
      return res.status(500).json({
        message: "Internal server error during parameter validation",
      });
    }
  };
}
