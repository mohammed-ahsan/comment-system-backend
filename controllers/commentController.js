const Comment = require('../models/Comment');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// @desc    Get all comments with pagination and sorting
// @route   GET /api/comments
// @access  Public
const getComments = async (req, res) => {
  try {
    // Validate and sanitize pagination parameters
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'newest';
    const parentCommentId = req.query.parentComment;

    // Edge case handling for pagination
    page = Math.max(1, page); // Ensure page is at least 1
    limit = Math.min(Math.max(1, limit), 100); // Limit between 1 and 100

    // Calculate skip with validation
    const skip = (page - 1) * limit;
    if (skip < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      });
    }

    // Validate sort parameter
    const validSortOptions = ['newest', 'mostLiked', 'mostDisliked'];
    if (!validSortOptions.includes(sort)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort option',
        validOptions: validSortOptions
      });
    }

    // Build sort object based on sort parameter from frontend
    let sortObj = {};
    
    switch (sort) {
      case 'mostLiked':
        sortObj = { 'likes': -1, createdAt: -1 };
        break;
      case 'mostDisliked':
        sortObj = { 'dislikes': -1, createdAt: -1 };
        break;
      case 'newest':
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    // Build query with validation
    let query = { isActive: true, parentComment: parentCommentId || null };

    // Validate parentCommentId if provided
    if (parentCommentId && !mongoose.Types.ObjectId.isValid(parentCommentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent comment ID'
      });
    }

    // Execute query with pagination and error handling
    let comments;
    let total;

    try {
      comments = await Comment.find(query)
        .populate('author', 'username avatar')
        .populate('parentComment', 'content author')
        .populate('replyCount')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(); // Use lean for better performance

      total = await Comment.countDocuments(query);
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error while fetching comments'
      });
    }

    // Handle empty results gracefully
    if (!comments || comments.length === 0) {
      // Check if page is beyond available pages
      const totalPages = Math.ceil(total / limit);
      if (page > totalPages && totalPages > 0) {
        return res.status(400).json({
          success: false,
          message: 'Page number exceeds available pages',
          currentPage: page,
          totalPages,
          total
        });
      }
    }

    // Add user reaction status if authenticated and ensure counts are included
    if (req.user && req.user.id) {
      comments.forEach(comment => {
        comment.isLikedByUser = comment.likes && comment.likes.some(
          like => like.user && like.user.toString() === req.user.id
        );
        comment.isDislikedByUser = comment.dislikes && comment.dislikes.some(
          dislike => dislike.user && dislike.user.toString() === req.user.id
        );
        comment.canEdit = comment.author && comment.author._id && 
          comment.author._id.toString() === req.user.id;
        
        // Ensure like and dislike counts are included
        comment.likeCount = comment.likes ? comment.likes.length : 0;
        comment.dislikeCount = comment.dislikes ? comment.dislikes.length : 0;
        comment.engagementScore = comment.likeCount - comment.dislikeCount;
      });
    } else {
      comments.forEach(comment => {
        comment.isLikedByUser = false;
        comment.isDislikedByUser = false;
        comment.canEdit = false;
        
        // Ensure like and dislike counts are included
        comment.likeCount = comment.likes ? comment.likes.length : 0;
        comment.dislikeCount = comment.dislikes ? comment.dislikes.length : 0;
        comment.engagementScore = comment.likeCount - comment.dislikeCount;
      });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          currentPage: page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
          // Additional metadata for enhanced pagination
          isFirstPage: page === 1,
          isLastPage: page === totalPages,
          startIndex: skip + 1,
          endIndex: Math.min(skip + limit, total),
          remainingItems: Math.max(0, total - (skip + limit))
        }
      },
      meta: {
        requestedAt: new Date().toISOString(),
        processingTime: Date.now() - req.startTime
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching comments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    const totalCount = await Comment.countDocuments({ isActive: true, parentComment: null });

    // Emit real-time update
    if (parentComment) {
      req.io.emit('newReply', comment);
    } else {
      req.io.emit('newComment', { comment, totalCount });
    }

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

    // Emit real-time update - different events for replies vs comments
    if (comment.parentComment) {
      req.io.emit('replyUpdated', comment);
    } else {
      req.io.emit('commentUpdated', comment);
    }

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

    let totalCount;
    if (!comment.parentComment) {
      totalCount = await Comment.countDocuments({ isActive: true, parentComment: null });
    }

    // Emit real-time update - different events for replies vs comments
    if (comment.parentComment) {
      req.io.emit('replyDeleted', { id: comment._id });
    } else {
      req.io.emit('commentDeleted', { id: comment._id, totalCount });
    }

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

    const reactionData = {
      commentId: comment._id,
      type: 'like',
      likeCount: comment.likeCount,
      dislikeCount: comment.dislikeCount,
      userId: req.user.id
    };

    // Emit different events for replies vs comments
    if (comment.parentComment) {
      req.io.emit('replyReaction', reactionData);
    } else {
      req.io.emit('commentReaction', reactionData);
    }

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

    const reactionData = {
      commentId: comment._id,
      type: 'dislike',
      likeCount: comment.likeCount,
      dislikeCount: comment.dislikeCount,
      userId: req.user.id
    };

    // Emit different events for replies vs comments
    if (comment.parentComment) {
      req.io.emit('replyReaction', reactionData);
    } else {
      req.io.emit('commentReaction', reactionData);
    }

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

    const reactionData = {
      commentId: comment._id,
      type: 'remove',
      likeCount: comment.likeCount,
      dislikeCount: comment.dislikeCount,
      userId: req.user.id
    };

    // Emit different events for replies vs comments
    if (comment.parentComment) {
      req.io.emit('replyReaction', reactionData);
    } else {
      req.io.emit('commentReaction', reactionData);
    }

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
    // Validate and sanitize pagination parameters
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'newest';

    // Edge case handling for pagination
    page = Math.max(1, page); // Ensure page is at least 1
    limit = Math.min(Math.max(1, limit), 100); // Limit between 1 and 100

    // Calculate skip with validation
    const skip = (page - 1) * limit;
    if (skip < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      });
    }

    // Validate comment ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid comment ID'
      });
    }

    // Validate sort parameter
    const validSortOptions = ['newest', 'mostLiked', 'mostDisliked'];
    if (!validSortOptions.includes(sort)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort option',
        validOptions: validSortOptions
      });
    }

    // Build sort object based on sort parameter from frontend
    let sortObj = {};
    
    switch (sort) {
      case 'mostLiked':
        sortObj = { 'likes': -1, createdAt: -1 };
        break;
      case 'mostDisliked':
        sortObj = { 'dislikes': -1, createdAt: -1 };
        break;
      case 'newest':
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    // Check if parent comment exists and is active
    const parentComment = await Comment.findById(req.params.id);
    if (!parentComment || !parentComment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Parent comment not found or inactive'
      });
    }

    // Execute query with pagination and error handling
    let replies;
    let total;

    try {
      replies = await Comment.find({ 
        parentComment: req.params.id, 
        isActive: true 
      })
        .populate('author', 'username avatar')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(); // Use lean for better performance

      total = await Comment.countDocuments({ 
        parentComment: req.params.id, 
        isActive: true 
      });
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error while fetching replies'
      });
    }

    // Handle empty results gracefully
    if (!replies || replies.length === 0) {
      // Check if page is beyond available pages
      const totalPages = Math.ceil(total / limit);
      if (page > totalPages && totalPages > 0) {
        return res.status(400).json({
          success: false,
          message: 'Page number exceeds available pages',
          currentPage: page,
          totalPages,
          total
        });
      }
    }

    // Add user reaction status if authenticated and ensure counts are included
    if (req.user && req.user.id) {
      replies.forEach(reply => {
        reply.isLikedByUser = reply.likes && reply.likes.some(
          like => like.user && like.user.toString() === req.user.id
        );
        reply.isDislikedByUser = reply.dislikes && reply.dislikes.some(
          dislike => dislike.user && dislike.user.toString() === req.user.id
        );
        reply.canEdit = reply.author && reply.author._id && 
          reply.author._id.toString() === req.user.id;
        
        // Ensure like and dislike counts are included
        reply.likeCount = reply.likes ? reply.likes.length : 0;
        reply.dislikeCount = reply.dislikes ? reply.dislikes.length : 0;
        reply.engagementScore = reply.likeCount - reply.dislikeCount;
      });
    } else {
      replies.forEach(reply => {
        reply.isLikedByUser = false;
        reply.isDislikedByUser = false;
        reply.canEdit = false;
        
        // Ensure like and dislike counts are included
        reply.likeCount = reply.likes ? reply.likes.length : 0;
        reply.dislikeCount = reply.dislikes ? reply.dislikes.length : 0;
        reply.engagementScore = reply.likeCount - reply.dislikeCount;
      });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        replies,
        pagination: {
          currentPage: page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
          // Additional metadata for enhanced pagination
          isFirstPage: page === 1,
          isLastPage: page === totalPages,
          startIndex: skip + 1,
          endIndex: Math.min(skip + limit, total),
          remainingItems: Math.max(0, total - (skip + limit))
        }
      },
      meta: {
        requestedAt: new Date().toISOString(),
        processingTime: Date.now() - req.startTime,
        parentCommentId: req.params.id
      }
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching replies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
