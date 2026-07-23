export const setAuthCookies = (
  res,
  accessToken,
  refreshToken
) => {
  const cookieOptions = {
    httpOnly: true,

    secure:
      process.env.NODE_ENV === "production",

    sameSite:
      "strict",

    maxAge:
      7 * 24 * 60 * 60 * 1000,
  };

  res.cookie(
    "accessToken",
    accessToken,
    cookieOptions
  );

  res.cookie(
    "refreshToken",
    refreshToken,
    cookieOptions
  );
};

export const clearAuthCookies = (res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
};