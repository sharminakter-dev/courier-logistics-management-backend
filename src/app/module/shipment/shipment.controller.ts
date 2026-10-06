import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { ShipmentService } from "./shipment.service";

const getUser = (req: Request) => {
	const user = req.user as IRequestUser | undefined;

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User information is missing");
	}

	return user;
};

const createShipment = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.createShipment(getUser(req), req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Shipment created. Please complete the payment.",
		data: result,
	});
});

const payShipment = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.payShipment(
		getUser(req),
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment session created",
		data: result,
	});
});

// bKash redirects the browser here, so we redirect back instead of sending JSON
const paymentCallback = catchAsync(async (req: Request, res: Response) => {
	try {
		const { redirectUrl } = await ShipmentService.paymentCallback(req.query);
		res.redirect(redirectUrl);
	} catch (error) {
		console.error("Payment callback failed:", (error as Error).message);
		res.redirect(
			`${config.frontend_url}/dashboard/my-shipments?error=payment-failed`,
		);
	}
});

const cancelShipment = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.cancelShipment(
		getUser(req),
		req.params.id as string,
		req.body ?? {},
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment cancelled successfully",
		data: result,
	});
});

const trackShipment = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.trackShipment(
		req.params.trackingNumber as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment tracking fetched successfully",
		data: result,
	});
});

const getMyShipments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ShipmentService.getMyShipments(
		getUser(req),
		req.query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Your shipments fetched successfully",
		data,
		meta,
	});
});

const getAllShipments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ShipmentService.getAllShipments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipments fetched successfully",
		data,
		meta,
	});
});

const getShipmentById = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.getShipmentById(
		getUser(req),
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment fetched successfully",
		data: result,
	});
});

const assignCourier = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.assignCourier(
		req.params.id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courier assigned successfully",
		data: result,
	});
});

const updateShipmentStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.updateShipmentStatus(
		getUser(req),
		req.params.id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment status updated successfully",
		data: result,
	});
});

export const ShipmentController = {
	createShipment,
	payShipment,
	paymentCallback,
	cancelShipment,
	trackShipment,
	getMyShipments,
	getAllShipments,
	getShipmentById,
	assignCourier,
	updateShipmentStatus,
};