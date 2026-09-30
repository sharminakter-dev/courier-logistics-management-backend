import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

const createToken = (
	payload: JwtPayload,
	secret: string,
	expiresIn: SignOptions["expiresIn"],
) => {
	return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token: string, secret: string) => {
	try {
		const verified = jwt.verify(token, secret) as JwtPayload;
		return { success: true as const, data: verified };
	} catch (error) {
		return { success: false as const, error: (error as Error).message };
	}
};

export const jwtUtils = {
	createToken,
	verifyToken,
};
