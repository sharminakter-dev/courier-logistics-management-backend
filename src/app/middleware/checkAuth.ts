import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../generated/prisma/enums";
import { UserStatus } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

declare global {
	namespace Express {
		interface Request {
			user?: {
				email: string;
				name: string;
				userId: string;
				role: Role;
			};
		}
	}
}

// auth()                         -> any authenticated user
// auth(Role.ADMIN)               -> ADMIN only
// auth(Role.ADMIN, Role.COURIER) -> ADMIN or COURIER
export const auth = (...requiredRoles: Role[]) => {
	return catchAsync(
		async (req: Request, _res: Response, next: NextFunction) => {
			const authHeader = req.headers.authorization;
			const bearerToken = authHeader?.startsWith("Bearer ")
				? authHeader.split(" ")[1]
				: undefined;
			const token = req.cookies?.accessToken ?? bearerToken;

			if (!token) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"You are not logged in. Please log in to access this resource.",
				);
			}

			const verified = jwtUtils.verifyToken(token, config.jwt_access_secret);

			if (!verified.success) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Invalid or expired access token. Please log in again.",
				);
			}

			// The DB is the source of truth for role/status, not the token.
			const user = await prisma.user.findUnique({
				where: { id: verified.data.userId },
			});

			if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"User not found. Please log in again.",
				);
			}

			if (user.status === UserStatus.BLOCKED) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Your account has been blocked. Please contact support.",
				);
			}

			if (requiredRoles.length && !requiredRoles.includes(user.role)) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Forbidden. You don't have permission to access this resource.",
				);
			}

			req.user = {
				email: user.email,
				name: user.name,
				userId: user.id,
				role: user.role,
			};

			next();
		},
	);
};
