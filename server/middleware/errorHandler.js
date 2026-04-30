/**
 * Global error-handling middleware for Express.
 * Catches thrown errors + unhandled rejections from async route handlers.
 */
export function errorHandler(err, _req, res, _next) {
  console.error("❌ Error:", err.message || err);

  // Sequelize validation errors
  if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
    const messages = err.errors?.map((e) => e.message) ?? [err.message];
    return res.status(400).json({ success: false, error: "Validation failed", details: messages });
  }

  // Sequelize foreign-key errors
  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({ success: false, error: "Related record not found" });
  }

  // Custom errors with status code
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || "Internal server error",
  });
}

/**
 * Wrap an async route handler so thrown errors are forwarded to Express error middleware.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
