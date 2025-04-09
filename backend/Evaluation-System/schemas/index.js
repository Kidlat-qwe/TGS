import Joi from 'joi';

// User validation schemas
const createUser = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().allow('', null),
  user_type: Joi.string().valid('admin', 'teacher', 'qa').required()
});

// Add other schemas as needed

const schemas = {
  createUser
  // Add other schemas here
};

export default schemas; 