import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";


const generateAccessToken = (userId) => {

  return jwt.sign(
    {
      id: userId,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn:
        process.env.JWT_ACCESS_EXPIRES,
    }
  );

};



const generateRefreshToken = (userId) => {

  return jwt.sign(
    {
      id: userId,
      // Unique token identifier so two logins for the same user within the
      // same second never produce byte-identical JWTs. Without this, the
      // `RefreshToken.token` unique index collides on the second login
      // (E11000 duplicate key -> 409 "Duplicate key error").
      jti: randomUUID(),
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn:
        process.env.JWT_REFRESH_EXPIRES,
    }
  );

};



export {
  generateAccessToken,
  generateRefreshToken,
};