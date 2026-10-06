import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PricingService } from "./pricing.service";

const getPricing = catchAsync(async (_req: Request, res: Response) => {
	const result = await PricingService.getActiveRule();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Pricing fetched successfully",
		data: result,
	});
});

const updatePricing = catchAsync(async (req: Request, res: Response) => {
	const result = await PricingService.updatePricing(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Pricing updated successfully",
		data: result,
	});
});

const quote = catchAsync(async (req: Request, res: Response) => {
	const result = await PricingService.quote(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Price calculated successfully",
		data: result,
	});
});

export const PricingController = { getPricing, updatePricing, quote };