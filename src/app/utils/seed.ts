import bcrypt from "bcryptjs";
import {
	AuthProvider,
	Role,
	UserStatus,
	VehicleType,
} from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

type TSeedInput = {
	label: string;
	role: Role;
	name?: string;
	email?: string;
	password?: string;
};

// Role-specific profile rows are created in the same query (single transaction)
const profileFor = (role: Role) => {
	switch (role) {
		case Role.CUSTOMER:
			return { customer: { create: {} } };
		case Role.COURIER:
			return { courier: { create: { vehicleType: VehicleType.MOTORBIKE } } };
		default:
			return {};
	}
};

const seedUser = async ({ label, role, name, email, password }: TSeedInput) => {
	try {
		if (!name || !email || !password) {
			console.log(`Skipping ${label}: name/email/password missing in env`);
			return;
		}

		const normalizedEmail = email.trim().toLowerCase();

		const existing = await prisma.user.findUnique({
			where: { email: normalizedEmail },
			select: { id: true },
		});

		if (existing) {
			console.log(`${label} already exists.`);
			return;
		}

		const hashedPassword = await bcrypt.hash(password, config.bcrypt_salt_rounds);

		await prisma.user.create({
			data: {
				name,
				email: normalizedEmail,
				password: hashedPassword,
				role,
				status: UserStatus.ACTIVE,
				authProvider: AuthProvider.CREDENTIAL,
				needPasswordChange: false,
				emailVerified: true,
				...profileFor(role),
			},
		});

		console.log(`${label} created.`);
	} catch (error) {
		// Seeding must never take the server down, and must never delete data
		console.error(`Error seeding ${label}:`, error);
	}
};

export const seedSuperAdmin = () =>
	seedUser({
		label: "Super Admin",
		role: Role.SUPER_ADMIN,
		name: config.super_admin_name,
		email: config.super_admin_email,
		password: config.super_admin_password,
});

export const seedAdmin = () =>
	seedUser({
		label: "Admin",
		role: Role.ADMIN,
		name: config.admin_name,
		email: config.admin_email,
		password: config.admin_password,
	});

export const seedTesterCourier = () =>
	seedUser({
		label: "Tester Courier",
		role: Role.COURIER,
		name: config.tester_courier_name,
		email: config.tester_courier_email,
		password: config.tester_courier_password,
	});

export const seedTesterCustomer = () =>
	seedUser({
		label: "Tester Customer",
		role: Role.CUSTOMER,
		name: config.tester_customer_name,
		email: config.tester_customer_email,
		password: config.tester_customer_password,
	});

export const runSeeders = async () => {
    await seedSuperAdmin(); 
	await seedAdmin();

	// Demo accounts are never created in production
	if (!config.is_production) {
		await seedTesterCourier();
		await seedTesterCustomer();
	}
};