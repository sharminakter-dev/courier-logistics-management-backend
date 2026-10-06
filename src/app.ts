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
import { ShipmentRoutes } from "./app/module/shipment/shipment.route";
import { HubRoutes, ZoneRoutes } from "./app/module/hub/hub.route";
import { HubTransferRoutes } from "./app/module/hub-transfer/hub-transfer.route";
import { CourierRoutes } from "./app/module/courier/courier.route";
import { PricingRoutes } from "./app/module/pricing/pricing.route";
import { EarningRoutes } from "./app/module/earning/earning.route";
import { NotificationRoutes } from "./app/module/notification/notification.route";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";

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
app.use("/api/v1/shipments", ShipmentRoutes);
app.use("/api/v1/hubs", HubRoutes);
app.use("/api/v1/zones", ZoneRoutes);
app.use("/api/v1/hub-transfers", HubTransferRoutes);
app.use("/api/v1/couriers", CourierRoutes);
app.use("/api/v1/pricing", PricingRoutes);
app.use("/api/v1/earnings", EarningRoutes);
app.use("/api/v1/notifications", NotificationRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);

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
