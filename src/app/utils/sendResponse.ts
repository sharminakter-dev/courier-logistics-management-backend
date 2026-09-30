import type { Response } from "express";

type TMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};

type TResponseData<T> = {
	success: boolean;
	statusCode: number;
	message: string;
	data: T;
	meta?: TMeta;
};

// Success shape: { success: true, message, data }  (+ meta for paginated lists)
export const sendResponse = <T>(res: Response, payload: TResponseData<T>) => {
	res.status(payload.statusCode).json({
		success: payload.success,
		message: payload.message,
		data: payload.data,
		...(payload.meta ? { meta: payload.meta } : {}),
	});
};
