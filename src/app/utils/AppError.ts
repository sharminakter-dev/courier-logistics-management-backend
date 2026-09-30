export type TErrorItem = {
	path: string;
	message: string;
};

export class AppError extends Error {
	public readonly statusCode: number;
	public readonly errors: TErrorItem[];

	constructor(statusCode: number, message: string, errors: TErrorItem[] = []) {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.errors = errors;
		Error.captureStackTrace?.(this, this.constructor);
	}
}
