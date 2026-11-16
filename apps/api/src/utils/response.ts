import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200, message?: string) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function sendError(res: Response, message: string, statusCode: number = 500, errors?: Record<string, string[]>) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
