import { z } from "zod";

const passwordSchema = z
	.string("Password is required")
	.min(8, "Password must be at least 8 characters")
	.max(64, "Password must be at most 64 characters")
	.regex(/[a-z]/, "Password must contain a lowercase letter")
	.regex(/[A-Z]/, "Password must contain an uppercase letter")
	.regex(/[0-9]/, "Password must contain a number")
	.regex(/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/, "Password must contain a special characters");

const registerCustomer = z.object({
	body: z.object({
		name: z
			.string("Name is required")
			.trim()
			.min(2, "Name must be at least 2 characters")
			.max(100, "Name must be at most 100 characters"),
		email: z.email("Please provide a valid email address"),
		password: passwordSchema,
		phone: z
			.string()
			.trim()
			.regex(/^\+?[0-9]{7,15}$/, "Please provide a valid phone number")
			.optional(),
	}),
});

const login = z.object({
	body: z.object({
		email: z.email("Please provide a valid email address"),
		password: z.string("Password is required").min(1, "Password is required"),
	}),
});

const googleLogin = z.object({
	body: z.object({
		idToken: z.string("Google idToken is required").min(1),
	}),
});

const refreshToken = z.object({
	body: z
		.object({
			refreshToken: z.string().min(1).optional(),
		})
		.optional(),
});

const forgotPassword = z.object({
	body: z.object({
		email: z.string("Password is required"),
	})
})

const resetPassword = z.object({
	body: z.object({
		password: z.string("Password is required").min(1, "Password is required"),
		newPassword: passwordSchema,
		otp: z.string("Otp is required")
	})
})

export const AuthValidation = {
	registerCustomer,
	login,
	googleLogin,
	refreshToken,
	forgotPassword,
	resetPassword
};
