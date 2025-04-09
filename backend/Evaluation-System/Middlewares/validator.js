// Validation middleware
const validator = {
  body: (schema) => {
    return (req, res, next) => {
      try {
        // For Joi validation
        const { error } = schema.validate(req.body);
        if (error) {
          return res.status(400).json({ error: error.details[0].message });
        }
        next();
      } catch (validationError) {
        console.error('Validation error:', validationError);
        return res.status(400).json({ 
          error: 'Validation error',
          details: validationError.message
        });
      }
    };
  }
};

export default validator; 