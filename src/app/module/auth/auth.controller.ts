import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { cookieUtils } from "../../utils/cookie";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";
import { redisClient } from "../../lib/redis";


const registerCustomer = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.registerCustomer(req.body);


	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Verification OTP sent to your email",
		data: result,
	});
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.verifyCustomerEmail(req.body);
	const { accessToken, refreshToken, user, customer } = result;

	cookieUtils.setAuthCookies(res, { accessToken, refreshToken });

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Email verified and customer registered successfully",
		data: { accessToken, refreshToken, user, customer },
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.loginUser(req.body);
	const { accessToken, refreshToken, user } = result;

	cookieUtils.setAuthCookies(res, { accessToken, refreshToken });

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: { accessToken, refreshToken, user },
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser | undefined;

	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request",
		);
	}

	const result = await AuthService.getMe(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token: string | undefined =
		req.cookies?.refreshToken ?? req.body?.refreshToken;

	if (!token) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}

	const result = await AuthService.refreshToken(token);

	cookieUtils.setAuthCookies(res, result);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: result,
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.googleLogin(req.body);
	const { accessToken, refreshToken, user } = result;

	cookieUtils.setAuthCookies(res, { accessToken, refreshToken });

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in with Google successfully",
		data: { accessToken, refreshToken, user },
	});
});

const logout = catchAsync(async (_req: Request, res: Response) => {
	cookieUtils.clearAuthCookies(res);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged out successfully",
		data: {},
	});
});

const forgotPassword =  catchAsync(async (req: Request, res: Response) =>{

	const payload = req.body;

	await AuthService.forgotPassword(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `OTP Sent to Email : ${payload.email}`,
		data: null
	});
})

const resetPassword =  catchAsync(async (req: Request, res: Response) =>{
	const payload = req.body;

	 await AuthService.resetPassword(payload);
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password Reset successfully",
		data: null,
	});
})



export const AuthController = {
	registerCustomer,
	verifyEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	logout,
	forgotPassword,
	resetPassword
};
