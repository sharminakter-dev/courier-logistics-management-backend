import path from "node:path";
import ejs from "ejs";
import config from "../../config";
import { transporter } from "../../lib/nodemailer";

// Never throws: the account already exists, so a mail failure must not fail the request
export const sendWelcomeEmail = async (name: string, email: string) => {
	try {
		const templatePath = path.join(
			process.cwd(),
			"src/app/templates/welcome-email.ejs",
		);

		const html = await ejs.renderFile(templatePath, {
			name,
			loginUrl: `${config.frontend_url}/login`,
		});

		await transporter.sendMail({
			from: config.email_sender,
			to: email,
			subject: "Welcome to Courier & Logistics",
			html,
		});
	} catch (error) {
		console.error("Failed to send welcome email:", (error as Error).message);
	}
};