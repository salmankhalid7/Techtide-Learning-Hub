import jwt from "jsonwebtoken";


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