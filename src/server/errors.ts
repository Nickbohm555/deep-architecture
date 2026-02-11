export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = "validation_error") {
    super(message, 400, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = "not_found") {
    super(message, 404, code);
  }
}

export function getHttpError(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return { status: error.status, error: error.message, code: error.code };
  }

  return { status: 500, error: fallbackMessage, code: "internal_error" };
}
