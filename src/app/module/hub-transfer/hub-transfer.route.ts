import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { HubTransferController } from "./hub-transfer.controller";
import { HubTransferValidation } from "./hub-transfer.validation";

const router = Router();

router.post(
	"/",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(HubTransferValidation.createTransfer),
	HubTransferController.createTransfer,
);

router.get(
	"/",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	HubTransferController.getTransfers,
);

router.get(
	"/:id",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	HubTransferController.getTransferById,
);

router.patch(
	"/:id/receive",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(HubTransferValidation.receiveTransfer),
	HubTransferController.receiveTransfer,
);

export const HubTransferRoutes = router;