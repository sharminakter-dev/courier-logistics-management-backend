import { ne } from "zod/locales";
import config from "../config"
import { redisClient } from "./redis";

export const getBkashIdToken = async()=>{

    try{
        const idTokenKey = "baksh:idToken"
        const refreshTokenKey = "baksh:refreshToken";

        let bkashIdToken = await redisClient.get(idTokenKey);
        let bkashRefreshToken = await redisClient.get(refreshTokenKey);

        const bkashIdTokenTTL = await redisClient.ttl(idTokenKey);
        const bkashRefreshTokenTTL = await redisClient.ttl(refreshTokenKey);

        // bkash id token remaining time is less than equal 10 min
        // bkash refresh token must exist
        // bkash refresh token remaining time is more than equal 10 min
        if(
            (bkashIdTokenTTL <= 600 || !bkashIdToken) 
            && bkashIdToken  
            && bkashRefreshTokenTTL > 600
        ){
            const refreshTokenResonse = await fetch(`${config.bkash_base_url}/tokenized/checkout/token/refresh`,{
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    username: config.bkash_username,
                    password: config.bkash_password
                },
                body: JSON.stringify({
                    app_key: config.bkash_app_key,
                    app_secret: config.bkash_app_secret,
                    refresh_token: bkashRefreshToken
                })
            });

            if(!refreshTokenResonse.ok){
                throw new Error("Bkash Refresh Token Run Failed.")
            }

            const bkashRefreshTokenResult = await refreshTokenResonse.json();

            bkashIdToken = bkashRefreshTokenResult.id_token as string;

            await redisClient.set(idTokenKey, bkashIdToken,{
                expiration: {
                    type: "EX",
                    value : 60 * 60 // 1hr
                }
            })

            return bkashIdToken;
        }

        // 
        if(bkashIdTokenTTL > 600){
            return bkashIdToken
        }

        const resonse = await fetch(`${config.bkash_base_url}/tokenized/checkout/token/grant`,{
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                username: config.bkash_username,
                password: config.bkash_password
            },
            body: JSON.stringify({
                app_key: config.bkash_app_key,
                app_secret: config.bkash_app_secret,
            })
        });

        if(!resonse.ok){
            throw new Error("Bkash Access Token Run Failed.")
        }

        const result = await resonse.json();

        // bkash id token set
        await redisClient.set(idTokenKey, result.id_token, {
            expiration: {
                type: "EX",
                value : 60*60 // 1hr
            }
        })

        // bkash refresh token set
        await redisClient.set(refreshTokenKey, result.refresh_token, {
            expiration: {
                type: "EX",
                value : 60 * 60 * 24 * 28 // 28 days
            }
        });

        bkashIdToken = result.id_token

        return bkashIdToken

    }catch(error: any){
        throw new Error(error.message)
    }

}