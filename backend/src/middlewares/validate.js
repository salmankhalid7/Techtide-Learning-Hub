/**
 * Generic request validation middleware.
 *
 * Validates request body, params, and query using
 * the provided Zod schema.
 *
 * The validated data is attached to req.validatedData
 * for downstream use.
 *
 * @param {import("zod").ZodSchema} schema
 * @returns {import("express").RequestHandler}
 */
const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.validatedData = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default validate;