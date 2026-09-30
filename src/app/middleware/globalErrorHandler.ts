import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError, type TErrorItem } from "../utils/AppError";

// Error shape: { success: false, message, errors: [] }
export const globalErrorHandler = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	if (!config.is_production) {
		console.error("Error from Global Error Handler:", err);
	}

	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let message = "Internal Server Error";
	let errors: TErrorItem[] = [];

	if (err instanceof ZodError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Validation failed";
		errors = err.issues.map((issue) => ({
			// path[0] is "body" | "query" | "params"; drop it for readability
			path: issue.path.slice(1).join("."),
			message: issue.message,
		}));
	} else if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errors = err.errors;
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			statusCode = httpStatus.CONFLICT;
			message = "A record with this value already exists";
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			message = "Related record does not exist (foreign key constraint failed)";
		} else if (err.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			message = "Requested record was not found";
		}
	} else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Invalid or missing fields in request";
	} else if (err instanceof Prisma.PrismaClientInitializationError) {
		statusCode = httpStatus.SERVICE_UNAVAILABLE;
		message = "Database is currently unavailable";
	} else if ((err as { type?: string })?.type === "entity.parse.failed") {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Malformed JSON in request body";
	} else if (err instanceof Error && !config.is_production) {
		message = err.message;
	}

	if (errors.length === 0) {
		errors = [{ path: "", message }];
	}

	res.status(statusCode).json({
		success: false,
		message,
		errors,
	});
};
