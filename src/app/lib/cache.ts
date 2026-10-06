import { redisClient } from "./redis";

const getOrSet = async <T>(
	key: string,
	ttlSeconds: number,
	loader: () => Promise<T>,
): Promise<T> => {
	try {
		const cached = await redisClient.get(key);
		if (cached) return JSON.parse(cached) as T;
	} catch (error) {
		console.error("Cache read failed:", (error as Error).message);
	}

	const fresh = await loader();

	try {
		await redisClient.set(key, JSON.stringify(fresh), {
			expiration: { type: "EX", value: ttlSeconds },
		});
	} catch (error) {
		console.error("Cache write failed:", (error as Error).message);
	}

	return fresh;
};

const del = async (key: string) => {
	try {
		await redisClient.del(key);
	} catch (error) {
		console.error("Cache delete failed:", (error as Error).message);
	}
};

export const cache = { getOrSet, del };