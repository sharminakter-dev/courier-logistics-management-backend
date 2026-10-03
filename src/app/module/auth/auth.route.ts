import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	validateRequest(AuthValidation.registerCustomer),
	AuthController.registerCustomer,
);
router.post(
	"/login",
	validateRequest(AuthValidation.login),
	AuthController.loginUser,
);
router.get(
	"/me",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.COURIER, Role.CUSTOMER),
	AuthController.getMe,
);
router.post(
	"/refresh-token",
	validateRequest(AuthValidation.refreshToken),
	AuthController.refreshToken,
);
router.post(
	"/google",
	validateRequest(AuthValidation.googleLogin),
	AuthController.googleLogin,
);
router.post("/logout", AuthController.logout);

export const AuthRoutes = router;
