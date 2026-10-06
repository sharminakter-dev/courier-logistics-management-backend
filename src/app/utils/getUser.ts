import type { Request } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../module/auth/auth.interface";
import { AppError } from "./AppError";

export const getUser = (req: Request) => {
	const user = req.user as IRequestUser | undefined;

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User information is missing");
	}

	return user;
};