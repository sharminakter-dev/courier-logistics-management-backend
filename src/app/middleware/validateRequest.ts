import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/**
 * Validates { body, query, params } against a Zod schema.
 * Unknown body keys are stripped (prevents mass-assignment, e.g. "role").
 * ZodError is forwarded to the global error handler.
 */
export const validateRequest = (schema: ZodType) => {
	return (req: Request, _res: Response, next: NextFunction) => {
		const result = schema.safeParse({
			body: req.body ?? {},
			query: req.query,
			params: req.params,
		});

		if (!result.success) {
			return next(result.error);
		}

		const parsed = result.data as { body?: unknown };
		if (parsed.body !== undefined) {
			req.body = parsed.body;
		}

		next();
	};
};
