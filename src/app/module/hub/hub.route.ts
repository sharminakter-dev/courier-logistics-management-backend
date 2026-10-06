import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { HubController } from "./hub.controller";
import { HubValidation } from "./hub.validation";

const router = Router();
const zoneRouter = Router();

const admins = [Role.SUPER_ADMIN, Role.ADMIN];

// ---- /api/v1/hubs ----
router.post(
	"/",
	auth(...admins),
	validateRequest(HubValidation.createHub),
	HubController.createHub,
);
router.get("/", auth(...admins, Role.COURIER), HubController.getAllHubs);
router.get("/:id", auth(...admins, Role.COURIER), HubController.getHubById);
router.patch(
	"/:id",
	auth(...admins),
	validateRequest(HubValidation.updateHub),
	HubController.updateHub,
);
router.delete("/:id", auth(...admins), HubController.deleteHub);

router.post(
	"/:id/zones",
	auth(...admins),
	validateRequest(HubValidation.createZone),
	HubController.createZone,
);
router.get("/:id/zones", auth(...admins, Role.COURIER), HubController.getZones);

// ---- /api/v1/zones ----
zoneRouter.patch(
	"/:zoneId",
	auth(...admins),
	validateRequest(HubValidation.updateZone),
	HubController.updateZone,
);
zoneRouter.delete("/:zoneId", auth(...admins), HubController.deleteZone);

export const HubRoutes = router;
export const ZoneRoutes = zoneRouter;