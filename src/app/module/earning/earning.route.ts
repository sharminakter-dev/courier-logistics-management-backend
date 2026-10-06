import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { EarningController } from "./earning.controller";
import { EarningValidation } from "./earning.validation";

const router = Router();

router.get("/my", auth(Role.COURIER), EarningController.getMyEarnings);

router.get(
	"/",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	EarningController.getAllEarnings,
);

router.patch(
	"/payout",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(EarningValidation.payout),
	EarningController.payoutCourier,
);

export const EarningRoutes = router;