import { NextFunction, Request, Response, Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Usercontroller } from "./user.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.patch(
    "/profile-image", 
    auth(Role.SUPER_ADMIN, Role.ADMIN, Role.COURIER, Role.CUSTOMER),
    upload.single("profileImage"),
    Usercontroller.uploadProfileImage
);



export const UserRoutes = router;
