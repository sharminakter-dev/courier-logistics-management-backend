import nodemailer from "nodemailer";
import config from "../config";

export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth:{
        user: config.sptm_user,
        pass: config.sptm_password
    }
});
