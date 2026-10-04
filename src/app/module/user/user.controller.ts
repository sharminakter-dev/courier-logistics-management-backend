import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from 'http-status';
import { UserService } from "./user.service";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {

    if(!req.file){
        throw new Error("No File Provided")
    }

    const userId= req.user?.userId;

    const user = await UserService.uploadProfileImage(req.file?.buffer, userId!)

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Image Uploaded Successfully",
        data: user,
    });
});


export const Usercontroller = {
    uploadProfileImage,
}