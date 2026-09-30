import type { Response } from "express";
import config from "../config";

const ONE_DAY = 1000 * 60 * 60 * 24;

// Browsers reject SameSite=None without Secure, so both depend on the env.
const baseOptions = {
	httpOnly: true,
	secure: config.is_production,
	sameSite: (config.is_production ? "none" : "lax") as "none" | "lax",
};

const setAuthCookies = (
	res: Response,
	tokens: { accessToken: string; refreshToken: string },
) => {
	res.cookie("accessToken", tokens.accessToken, {
		...baseOptions,
		maxAge: ONE_DAY,
	});
	res.cookie("refreshToken", tokens.refreshToken, {
		...baseOptions,
		maxAge: ONE_DAY * 7,
	});
};

const clearAuthCookies = (res: Response) => {
	res.clearCookie("accessToken", baseOptions);
	res.clearCookie("refreshToken", baseOptions);
};

export const cookieUtils = {
	setAuthCookies,
	clearAuthCookies,
};
