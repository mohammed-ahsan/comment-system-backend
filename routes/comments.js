const express = require('express');
const {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
  dislikeComment,
  removeReaction,
  getReplies
} = require('../controllers/commentController');
const { protect, optionalAuth } = require('../middleware/auth');
const {
  validateCreateComment,
  validateUpdateComment,
  validateObjectId
} = require('../utils/validation');

const router = express.Router();

// @route   GET /api/comments
// @desc    Get all comments with pagination and sorting
// @access  Public
router.get('/', optionalAuth, getComments);

// @route   POST /api/comments
// @desc    Create a new comment
// @access  Private
router.post('/', protect, validateCreateComment, createComment);

// @route   PUT /api/comments/:id
// @desc    Update a comment
// @access  Private
router.put('/:id', protect, validateObjectId('id'), validateUpdateComment, updateComment);

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', protect, validateObjectId('id'), deleteComment);

// @route   POST /api/comments/:id/like
// @desc    Like a comment
// @access  Private
router.post('/:id/like', protect, validateObjectId('id'), likeComment);

// @route   POST /api/comments/:id/dislike
// @desc    Dislike a comment
// @access  Private
router.post('/:id/dislike', protect, validateObjectId('id'), dislikeComment);

// @route   DELETE /api/comments/:id/reaction
// @desc    Remove reaction from a comment
// @access  Private
router.delete('/:id/reaction', protect, validateObjectId('id'), removeReaction);

// @route   GET /api/comments/:id/replies
// @desc    Get replies for a comment
// @access  Public
router.get('/:id/replies', optionalAuth, validateObjectId('id'), getReplies);

module.exports = router;
