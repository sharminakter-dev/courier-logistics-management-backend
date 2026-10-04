import nodemailer from "nodemailer";
import config from "../config";

export const transporter = nodemailer.createTransport({
    service: "gmail",
    host: config.smtp_host,
	port: config.smtp_port,
    auth:{
        user: config.sptm_user,
        pass: config.sptm_password
    }
});
