import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { UserRoutes } from "./app/module/user/user.routes";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// NOTE: when adding Stripe/SSLCommerz webhooks, mount their raw-body
// route BEFORE express.json().
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);

app.get("/", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Courier & Logistics Management Backend",
		data: {},
	});
});

// notFound must come before the error handler
app.use(notFound);
app.use(globalErrorHandler);

export default app;
