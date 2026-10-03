import dotenv from "dotenv";
import type { SignOptions } from "jsonwebtoken";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const requiredEnv = [
	"DATABASE_URL",
	"JWT_ACCESS_SECRET",
	"JWT_REFRESH_SECRET",
	"JWT_ACCESS_EXPIRES_IN",
	"JWT_REFRESH_EXPIRES_IN",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"FRONTEND_URL",
] as const;

for (const key of requiredEnv) {
	if (!process.env[key]) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export default {
	node_env: nodeEnv,
	is_production: nodeEnv === "production",
	port: Number(process.env.PORT ?? 5000),
	database_url: process.env.DATABASE_URL as string,
	backend_url: process.env.BACKEND_URL,
	frontend_url: process.env.FRONTEND_URL as string,
	bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
	jwt_access_secret: process.env.JWT_ACCESS_SECRET as string,
	jwt_refresh_secret: process.env.JWT_REFRESH_SECRET as string,
	jwt_access_expires_in: process.env
		.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
	jwt_refresh_expires_in: process.env
		.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
	google_client_id: process.env.GOOGLE_CLIENT_ID as string,
	google_client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
	super_admin_name: process.env.SUPER_ADMIN_NAME,
	super_admin_email: process.env.SUPER_ADMIN_EMAIL,
	super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
	admin_name: process.env.ADMIN_NAME,
	admin_email: process.env.ADMIN_EMAIL,
	admin_password: process.env.ADMIN_PASSWORD,
	tester_courier_name: process.env.TESTER_COURIER_NAME,
	tester_courier_email: process.env.TESTER_COURIER_EMAIL,
	tester_courier_password: process.env.TESTER_COURIER_PASSWORD,
	tester_customer_name: process.env.TESTER_CUSTOMER_NAME,
	tester_customer_email: process.env.TESTER_CUSTOMER_EMAIL,
	tester_customer_password: process.env.TESTER_CUSTOMER_PASSWORD,
	redis_user: process.env.REDIS_USER,
    redis_password: process.env.REDIS_PASSWORD,
    redis_host: process.env.REDIS_HOST,
    redis_port: process.env.REDIS_PORT,
	sptm_user: process.env.SMTP_USER,
    sptm_password: process.env.SMTP_PASSWORD,
    email_sender: process.env.EMAIL_SENDER
};
