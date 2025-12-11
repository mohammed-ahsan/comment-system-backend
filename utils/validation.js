const { body } = require('express-validator');

// User registration validation
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter and one number')
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Comment creation validation
const validateCreateComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
    .escape(),
  
  body('parentComment')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent comment ID')
];

// Comment update validation
const validateUpdateComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
    .escape()
];

// MongoDB ObjectId validation
const validateObjectId = (param) => {
  return (req, res, next) => {
    const { validationResult } = require('express-validator');
    const objectId = req.params[param];
    
    if (!objectId || !objectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${param} ID format`
      });
    }
    
    next();
  };
};

// Pagination validation
const validatePagination = [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateComment,
  validateUpdateComment,
  validateObjectId,
  validatePagination
};
