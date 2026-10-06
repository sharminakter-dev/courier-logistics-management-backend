import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourierController } from "./courier.controller";
import { CourierValidation } from "./courier.validation";

const router = Router();

const admins = [Role.SUPER_ADMIN, Role.ADMIN];

router.post(
	"/",
	auth(...admins),
	validateRequest(CourierValidation.createCourier),
	CourierController.createCourier,
);

router.get("/", auth(...admins), CourierController.getAllCouriers);

// /me routes must stay above /:id
router.get("/me", auth(Role.COURIER), CourierController.getMyProfile);
router.get("/me/shipments", auth(Role.COURIER), CourierController.getMyShipments);
router.patch(
	"/me/availability",
	auth(Role.COURIER),
	validateRequest(CourierValidation.updateAvailability),
	CourierController.updateAvailability,
);

router.get("/:id", auth(...admins), CourierController.getCourierById);
router.patch(
	"/:id",
	auth(...admins),
	validateRequest(CourierValidation.updateCourier),
	CourierController.updateCourier,
);

export const CourierRoutes = router;