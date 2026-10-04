import { v2 as Cloudinary } from 'cloudinary';
import config from '../config';

Cloudinary.config({
  cloud_name: config.coudinary_cloud_name,
  api_key: config.coudinary_api_key,
  api_secret: config.coudinary_api_secret
});

export const cloudinary = Cloudinary;