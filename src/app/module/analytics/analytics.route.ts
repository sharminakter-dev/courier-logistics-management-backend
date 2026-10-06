import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

const admins = [Role.SUPER_ADMIN, Role.ADMIN];

router.get("/overview", auth(...admins), AnalyticsController.getOverview);
router.get("/shipments-trend", auth(...admins), AnalyticsController.getShipmentsTrend);
router.get("/top-couriers", auth(...admins), AnalyticsController.getTopCouriers);

export const AnalyticsRoutes = router;