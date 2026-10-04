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
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterCustomerPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface";
import { redisClient } from "../../lib/redis";
import crypto from "crypto";
import { transporter } from "../../lib/nodemailer";
import ejs from "ejs";
import path from "path";

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

const OTP_EXPIRATION_SECONDS = 5 * 60;
const MAX_OTP_ATTEMPTS = 5;

const otpKey = (email: string) => `customer-registration-otp:${email}`;
const dataKey = (email: string) => `customer-registration-data:${email}`;
const attemptsKey = (email: string) => `customer-registration-attempts:${email}`;

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
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	const expiry = {
		expiration: { type: "EX" as const, value: OTP_EXPIRATION_SECONDS },
	};

	await Promise.all([
		redisClient.set(otpKey(email), otpValue, expiry),
		redisClient.set(
			dataKey(email),
			JSON.stringify({ name, email, password: hashedPassword, phone }),
			expiry,
		),
		redisClient.del(attemptsKey(email)),
	]);

	try {
		const templatePath = path.join(
			process.cwd(),
			"src/app/templates/registration-otp.ejs",
		);

		const templateData = {
			name,
			email,
			otpValue,
			expirationMinutes: Math.ceil(OTP_EXPIRATION_SECONDS / 60),
		};

		const html = await ejs.renderFile(templatePath, templateData);

		await transporter.sendMail({
			from: config.email_sender,
			to: email,
			subject: "Email Verification",
			html,
		});
	} catch (error) {
		await redisClient.del([otpKey(email), dataKey(email)]);
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"Failed to send verification email. Please try again.",
		);
	}

	return { email, expiresInSeconds: OTP_EXPIRATION_SECONDS };
};

const verifyCustomerEmail = async (payload: IVerifyEmailPayload) => {
	const { otp } = payload;
	const email = payload.email.trim().toLowerCase();

	const storedOtp = await redisClient.get(otpKey(email));

	if (!storedOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP expired or not found. Please register again.",
		);
	}

	// Limit guesses per OTP
	const attempts = await redisClient.incr(attemptsKey(email));
	if (attempts === 1) {
		await redisClient.expire(attemptsKey(email), OTP_EXPIRATION_SECONDS);
	}
	if (attempts > MAX_OTP_ATTEMPTS) {
		await redisClient.del([otpKey(email), dataKey(email), attemptsKey(email)]);
		throw new AppError(
			httpStatus.TOO_MANY_REQUESTS,
			"Too many wrong attempts. Please register again.",
		);
	}

	if (storedOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}

	const rawData = await redisClient.get(dataKey(email));

	if (!rawData) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Registration data expired. Please register again.",
		);
	}

	const data = JSON.parse(rawData) as {
		name: string;
		email: string;
		password: string;
		phone?: string;
	};

	// If the email got taken meanwhile, Prisma P2002 -> 409 via the error handler
	const createdUser = await prisma.user.create({
		data: {
			name: data.name,
			email: data.email,
			phone: data.phone,
			password: data.password,
			role: Role.CUSTOMER,
			status: UserStatus.ACTIVE,
			authProvider: AuthProvider.CREDENTIAL,
			emailVerified: true,
			customer: { create: {} },
		},
		omit: { password: true },
		include: { customer: true },
	});

	await redisClient.del([otpKey(email), dataKey(email), attemptsKey(email)]);

	// Account already exists, so a mail failure must not fail the request
	try {
		const templatePath = path.join(
			process.cwd(),
			"src/app/templates/welcome-email.ejs",
		);

		const html = await ejs.renderFile(templatePath, {
			name: createdUser.name,
			loginUrl: `${config.frontend_url}/login`,
		});

		await transporter.sendMail({
			from: config.email_sender,
			to: email,
			subject: "Welcome to Courier & Logistics",
			html,
		});
		

	} catch (error) {
		console.error(
			"Failed to send welcome email:",
			(error as Error).message,
		);
	}

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

		try {
			const templatePath = path.join(
				process.cwd(),
				"src/app/templates/welcome-email.ejs",
			);

			const html = await ejs.renderFile(templatePath, {
				name: user.name,
				loginUrl: `${config.frontend_url}/login`,
			});

			await transporter.sendMail({
				from: config.email_sender,
				to: email,
				subject: "Welcome to Courier & Logistics",
				html,
			});
		} catch (error) {
			console.error("Failed to send welcome email:", error);
		}
		
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

const forgotPassword = async(payload: IForgotPasswordPayload)=>{
	const {email} = payload

	const isUserExist = await prisma.user.findUnique({
		where:{
			email
		}
	});

	if(!isUserExist){
		throw new Error("User Does not Exist")
	}

	if(!isUserExist.emailVerified){
		throw new Error("User is not Verified")
	}

	if(isUserExist.status === "BLOCKED"){
		throw new Error("User is Blocked")
	}

	if(isUserExist.isDeleted || isUserExist.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	if(isUserExist.authProvider !== "CREDENTIAL"){
		throw new Error("User Has Account With Google")
	}

	const otp = crypto.randomInt(100000,1000000).toString();

	const key = `forget-password-otp:${isUserExist.email}`;

	const expirationSeconds =5 * 60

	await redisClient.set(key, otp,{
		expiration: {
			type: "EX",
			value: 5 * 60
		}
	})

	const templatePath = path.join(process.cwd(), "src/app/templates/forgot-password.ejs")

	const templateData = {
		name: isUserExist.name,
		otp,
		expirationMinutes : expirationSeconds / 60
	}

	const html = await ejs.renderFile(templatePath, templateData)

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExist.email,
		subject: "Forgot Password",
		html: html
	})


}

const resetPassword = async(payload: IResetPasswordPayload)=>{
	const {email, newPassword, otp} = payload

	const isUserExist = await prisma.user.findUnique({
		where:{
			email
		}
	});

	if(!isUserExist){
		throw new Error("User Does not Exist")
	}

	if(!isUserExist.emailVerified){
		throw new Error("User is not Verified")
	}

	if(isUserExist.status === "BLOCKED"){
		throw new Error("User is Blocked")
	}

	if(isUserExist.isDeleted || isUserExist.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	if(isUserExist.authProvider !== "CREDENTIAL"){
		throw new Error("User Has Accoubt With Google")
	}

	const key = `forget-password-otp:${isUserExist.email}`

	const redisOtp = await redisClient.get(key)

	if(!redisOtp){
		throw new Error("Invalid OTP");
	}

	if(redisOtp !== otp){
		throw new Error("OTP Does Not Match");
	}

	const hashedNewPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds))

	await prisma.user.update({
		where:{
			email: isUserExist.email
		},
		data:{
			password: hashedNewPassword
		}
	})

	await redisClient.del(key);

	const templatePath = path.join(process.cwd(), "src/app/templates/reset-password-success.ejs");

	const templateData = {
		name: isUserExist.name,
	}

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExist.email,
		subject: "Password Reset",
		html: html
	});
	
}

export const AuthService = {
	registerCustomer,
	verifyCustomerEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword
};
