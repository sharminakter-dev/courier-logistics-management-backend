import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { HubService } from "./hub.service";

const createHub = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.createHub(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Hub created successfully",
		data: result,
	});
});

const getAllHubs = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await HubService.getAllHubs(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hubs fetched successfully",
		data,
		meta,
	});
});

const getHubById = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.getHubById(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub fetched successfully",
		data: result,
	});
});

const updateHub = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.updateHub(req.params.id as string, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub updated successfully",
		data: result,
	});
});

const deleteHub = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.deleteHub(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub deactivated successfully",
		data: result,
	});
});

const createZone = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.createZone(
		req.params.id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Zone created successfully",
		data: result,
	});
});

const getZones = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.getZones(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zones fetched successfully",
		data: result,
	});
});

const updateZone = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.updateZone(
		req.params.zoneId as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zone updated successfully",
		data: result,
	});
});

const deleteZone = catchAsync(async (req: Request, res: Response) => {
	const result = await HubService.deleteZone(req.params.zoneId as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zone deleted successfully",
		data: result,
	});
});

export const HubController = {
	createHub,
	getAllHubs,
	getHubById,
	updateHub,
	deleteHub,
	createZone,
	getZones,
	updateZone,
	deleteZone,
};