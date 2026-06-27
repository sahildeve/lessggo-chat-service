export const protectInternal = (req, res, next) => {
  const serviceKey = req.headers["x-service-key"];
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;

  if (!expectedKey || serviceKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  next();
};
