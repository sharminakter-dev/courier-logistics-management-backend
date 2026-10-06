import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PricingController } from "./pricing.controller";
import { PricingValidation } from "./pricing.validation";

const router = Router();

router.get("/", PricingController.getPricing);
router.post(
	"/quote",
	validateRequest(PricingValidation.quote),
	PricingController.quote,
);
router.put(
	"/",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(PricingValidation.updatePricing),
	PricingController.updatePricing,
);

export const PricingRoutes = router;