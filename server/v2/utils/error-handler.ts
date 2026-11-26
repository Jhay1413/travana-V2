export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public code?: string,
    /** Extra fields a route may put in its error body (the portal adds them next to `error` and `code`). */
    public details?: Record<string, unknown>,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
