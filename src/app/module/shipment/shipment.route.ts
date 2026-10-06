import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ShipmentController } from "./shipment.controller";
import { ShipmentValidation } from "./shipment.validation";

const router = Router();

router.post(
	"/",
	auth(Role.CUSTOMER),
	validateRequest(ShipmentValidation.createShipment),
	ShipmentController.createShipment,
);

// bKash calls this (no login), so the service confirms the payment with bKash
router.get("/payment/callback", ShipmentController.paymentCallback);

// public tracking
router.get("/track/:trackingNumber", ShipmentController.trackShipment);

router.get(
	"/my-shipments",
	auth(Role.CUSTOMER),
	ShipmentController.getMyShipments,
);

router.get(
	"/",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	ShipmentController.getAllShipments,
);

router.get(
	"/:id",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.COURIER, Role.CUSTOMER),
	ShipmentController.getShipmentById,
);

router.post("/:id/pay", auth(Role.CUSTOMER), ShipmentController.payShipment);

router.patch(
	"/:id/cancel",
	auth(Role.CUSTOMER, Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(ShipmentValidation.cancelShipment),
	ShipmentController.cancelShipment,
);

router.patch(
	"/:id/assign-courier",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(ShipmentValidation.assignCourier),
	ShipmentController.assignCourier,
);

router.patch(
	"/:id/status",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.COURIER),
	validateRequest(ShipmentValidation.updateStatus),
	ShipmentController.updateShipmentStatus,
);

export const ShipmentRoutes = router;