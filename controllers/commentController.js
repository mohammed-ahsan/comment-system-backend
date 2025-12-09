const Comment = require('../models/Comment');
const { validationResult } = require('express-validator');

// @desc    Get all comments with pagination and sorting
// @route   GET /api/comments
// @access  Public
const getComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const parentCommentId = req.query.parentComment;

    // Calculate skip
    const skip = (page - 1) * limit;

    // Build sort object
    let sort = {};
    
    switch (sortBy) {
      case 'mostLiked':
        sort = { 'likes.length': -1, createdAt: -1 };
        break;
      case 'mostDisliked':
        sort = { 'dislikes.length': -1, createdAt: -1 };
        break;
      case 'engagement':
        sort = { engagementScore: -1, createdAt: -1 };
        break;
      default:
        sort = { [sortBy]: sortOrder };
    }

    // Build query
    let query = { isActive: true, parentComment: parentCommentId || null };

    // Execute query with pagination
    const comments = await Comment.find(query)
      .populate('author', 'username avatar')
      .populate('parentComment', 'content author')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Comment.countDocuments(query);

    // Add user reaction status if authenticated
    if (req.user) {
      comments.forEach(comment => {
        comment.isLikedByUser = comment.likes.some(
          like => like.user.toString() === req.user.id
        );
        comment.isDislikedByUser = comment.dislikes.some(
          dislike => dislike.user.toString() === req.user.id
        );
        comment.canEdit = comment.author._id.toString() === req.user.id;
      });
    } else {
      comments.forEach(comment => {
        comment.isLikedByUser = false;
        comment.isDislikedByUser = false;
        comment.canEdit = false;
      });
    }

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching comments'
    });
  }
};

// @desc    Create a new comment
// @route   POST /api/comments
// @access  Private
const createComment = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { content, parentComment } = req.body;

    // If it's a reply, verify parent comment exists
    if (parentComment) {
      const parentExists = await Comment.findById(parentComment);
      if (!parentExists || !parentExists.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Parent comment not found'
        });
      }
    }

    // Create comment
    const comment = await Comment.create({
      content,
      author: req.user.id,
      parentComment: parentComment || null
    });

    // Populate author info
    await comment.populate('author', 'username avatar');

    // Emit real-time update
    req.io.emit('newComment', comment);

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: { comment }
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating comment'
    });
  }
};

// @desc    Update a comment
// @route   PUT /api/comments/:id
// @access  Private
const updateComment = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { content } = req.body;

    // Find comment
    const comment = await Comment.findById(req.params.id);

    if (!comment || !comment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user can edit
    if (!comment.canModify(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this comment'
      });
    }

    // Update comment
    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();
    await comment.populate('author', 'username avatar');

    // Emit real-time update
    req.io.emit('updatedComment', comment);

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: { comment }
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating comment'
    });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
  try {
    // Find comment
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user can delete
    if (!comment.canModify(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }

    // Soft delete
    comment.isActive = false;
    await comment.save();

    // Emit real-time update
    req.io.emit('deletedComment', { id: comment._id });

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting comment'
    });
  }
};

// @desc    Like a comment
// @route   POST /api/comments/:id/like
// @access  Private
const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment || !comment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    await comment.addLike(req.user.id);
    await comment.populate('author', 'username avatar');

    // Emit real-time update
    req.io.emit('commentReaction', {
      commentId: comment._id,
      type: 'like',
      likeCount: comment.likeCount,
      dislikeCount: comment.dislikeCount,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Comment liked successfully',
      data: {
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        isLikedByUser: true,
        isDislikedByUser: false
      }
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error liking comment'
    });
  }
};

// @desc    Dislike a comment
// @route   POST /api/comments/:id/dislike
// @access  Private
const dislikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment || !comment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    await comment.addDislike(req.user.id);
    await comment.populate('author', 'username avatar');

    // Emit real-time update
    req.io.emit('commentReaction', {
      commentId: comment._id,
      type: 'dislike',
      likeCount: comment.likeCount,
      dislikeCount: comment.dislikeCount,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Comment disliked successfully',
      data: {
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        isLikedByUser: false,
        isDislikedByUser: true
      }
    });
  } catch (error) {
    console.error('Dislike comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error disliking comment'
    });
  }
};

// @desc    Remove reaction from a comment
// @route   DELETE /api/comments/:id/reaction
// @access  Private
const removeReaction = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment || !comment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    await comment.removeReaction(req.user.id);
    await comment.populate('author', 'username avatar');

    // Emit real-time update
    req.io.emit('commentReaction', {
      commentId: comment._id,
      type: 'remove',
      likeCount: comment.likeCount,
      dislikeCount: comment.dislikeCount,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Reaction removed successfully',
      data: {
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        isLikedByUser: false,
        isDislikedByUser: false
      }
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing reaction'
    });
  }
};

// @desc    Get replies for a comment
// @route   GET /api/comments/:id/replies
// @access  Public
const getReplies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    // Build sort object
    let sort = {};
    
    switch (sortBy) {
      case 'mostLiked':
        sort = { 'likes.length': -1, createdAt: -1 };
        break;
      case 'mostDisliked':
        sort = { 'dislikes.length': -1, createdAt: -1 };
        break;
      case 'engagement':
        sort = { engagementScore: -1, createdAt: -1 };
        break;
      default:
        sort = { [sortBy]: sortOrder };
    }

    // Get replies for the specific comment
    const replies = await Comment.find({ 
      parentComment: req.params.id, 
      isActive: true 
    })
      .populate('author', 'username avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Comment.countDocuments({ 
      parentComment: req.params.id, 
      isActive: true 
    });

    // Add user reaction status if authenticated
    if (req.user) {
      replies.forEach(reply => {
        reply.isLikedByUser = reply.likes.some(
          like => like.user.toString() === req.user.id
        );
        reply.isDislikedByUser = reply.dislikes.some(
          dislike => dislike.user.toString() === req.user.id
        );
        reply.canEdit = reply.author._id.toString() === req.user.id;
      });
    } else {
      replies.forEach(reply => {
        reply.isLikedByUser = false;
        reply.isDislikedByUser = false;
        reply.canEdit = false;
      });
    }

    res.json({
      success: true,
      data: {
        replies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching replies'
    });
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
  dislikeComment,
  removeReaction,
  getReplies
};
