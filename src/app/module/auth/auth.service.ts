import bcrypt from "bcryptjs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type {
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterCustomerPayload,
	IRequestUser,
} from "./auth.interface";

type TTokenUser = {
	id: string;
	name: string;
	email: string;
	role: Role;
};

type TStatusUser = {
	status: UserStatus;
	isDeleted: boolean;
};

const generateTokens = (user: TTokenUser) => {
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in,
	);

	return { accessToken, refreshToken };
};

const assertUserIsActive = (user: TStatusUser) => {
	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is deleted");
	}
	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is blocked");
	}
};

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
	const { name, password, phone } = payload;
	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({
		where: { email },
		select: { id: true },
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const hashedPassword = await bcrypt.hash(password, config.bcrypt_salt_rounds);

	// Nested create runs inside a single DB transaction (user + customer profile)
	const createdUser = await prisma.user.create({
		data: {
			name,
			email,
			phone,
			password: hashedPassword,
			role: Role.CUSTOMER,
			status: UserStatus.ACTIVE,
			authProvider: AuthProvider.CREDENTIAL,
			emailVerified: false,
			customer: { create: {} },
		},
		omit: { password: true },
		include: { customer: true },
	});

	const { customer, ...user } = createdUser;
	const tokens = generateTokens(user);

	return { user, customer, ...tokens };
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const foundUser = await prisma.user.findUnique({ where: { email } });

	// Same message for "no user" and "wrong password" to avoid user enumeration
	if (!foundUser) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}

	assertUserIsActive(foundUser);

	if (!foundUser.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account was registered with Google. Please log in with Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(password, foundUser.password);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}

	const { password: _password, ...user } = foundUser;
	const tokens = generateTokens(user);

	return { user, ...tokens };
};

const getMe = async (user: IRequestUser) => {
	const foundUser = await prisma.user.findUnique({
		where: { id: user.userId },
		include: { customer: true, courier: true },
		omit: { password: true },
	});

	if (!foundUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return foundUser;
};

const refreshToken = async (token: string) => {
	const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);

	if (!verified.success) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
	}

	const user = await prisma.user.findUnique({
		where: { id: verified.data.userId },
	});

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User not found");
	}

	assertUserIsActive(user);

	return generateTokens(user);
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googlePayload: TokenPayload | undefined;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});
		googlePayload = ticket.getPayload();
	} catch {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired Google ID token",
		);
	}

	if (!googlePayload?.email || !googlePayload.sub) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Google account email not found",
		);
	}

	// Google has verified the email, so linking to an existing account is safe
	if (!googlePayload.email_verified) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Google account email is not verified",
		);
	}

	const email = googlePayload.email.trim().toLowerCase();
	const name = googlePayload.name ?? email.split("@")[0];

	let user = await prisma.user.findUnique({ where: { email } });

	if (!user) {
		// First-time Google sign-in -> new CUSTOMER
		user = await prisma.user.create({
			data: {
				name,
				email,
				role: Role.CUSTOMER,
				googleId: googlePayload.sub,
				authProvider: AuthProvider.GOOGLE,
				emailVerified: true,
				customer: { create: {} },
			},
		});
	} else {
		assertUserIsActive(user);

		if (user.googleId && user.googleId !== googlePayload.sub) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This email is linked to a different Google account",
			);
		}

		// Existing credential account -> link Google to it
		if (!user.googleId) {
			user = await prisma.user.update({
				where: { id: user.id },
				data: { googleId: googlePayload.sub, emailVerified: true },
			});
		}
	}

	const { password: _password, ...safeUser } = user;
	const tokens = generateTokens(safeUser);

	return { user: safeUser, ...tokens };
};

export const AuthService = {
	registerCustomer,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
};
