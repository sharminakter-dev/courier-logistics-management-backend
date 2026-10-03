import type { Server } from "node:http";
import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { runSeeders } from "./app/utils/seed";
import { redisClient } from "./app/lib/redis";
import { transporter } from "./app/lib/nodemailer";

let server: Server;

const shutdown = async (signal: string) => {
	console.log(`${signal} received. Shutting down...`);
	server?.close(async () => {
		await prisma.$disconnect();
		process.exit(0);
	});
};

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisClient.connect();
        console.log("Redis Connected Successfully");

		await transporter.verify();
        console.log("NodeMailer Connected Successfully")

		await runSeeders(); // added

		server = app.listen(config.port, () => {
			console.log(`Server is running on port ${config.port}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main();
