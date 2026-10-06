import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { getUser } from "../../utils/getUser";
import { sendResponse } from "../../utils/sendResponse";
import { CourierService } from "./courier.service";

const createCourier = catchAsync(async (req: Request, res: Response) => {
	const result = await CourierService.createCourier(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Courier created successfully",
		data: result,
	});
});

const getAllCouriers = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await CourierService.getAllCouriers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Couriers fetched successfully",
		data,
		meta,
	});
});

const getCourierById = catchAsync(async (req: Request, res: Response) => {
	const result = await CourierService.getCourierById(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courier fetched successfully",
		data: result,
	});
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await CourierService.getMyProfile(getUser(req));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courier profile fetched successfully",
		data: result,
	});
});

const updateAvailability = catchAsync(async (req: Request, res: Response) => {
	const result = await CourierService.updateAvailability(
		getUser(req),
		req.body.isAvailable,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Availability updated successfully",
		data: result,
	});
});

const getMyShipments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await CourierService.getMyShipments(
		getUser(req),
		req.query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assigned shipments fetched successfully",
		data,
		meta,
	});
});

const updateCourier = catchAsync(async (req: Request, res: Response) => {
	const result = await CourierService.updateCourier(
		req.params.id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courier updated successfully",
		data: result,
	});
});

export const CourierController = {
	createCourier,
	getAllCouriers,
	getCourierById,
	getMyProfile,
	updateAvailability,
	getMyShipments,
	updateCourier,
};