const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  dislikes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });
commentSchema.index({ createdAt: -1 });

// Virtual for like count
commentSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for dislike count
commentSchema.virtual('dislikeCount').get(function() {
  return this.dislikes.length;
});

// Virtual for total engagement
commentSchema.virtual('engagementScore').get(function() {
  return this.likes.length - this.dislikes.length;
});

commentSchema.virtual('replyCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true,
  match: { isActive: true }
});

// Method to check if user liked the comment
commentSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to check if user disliked the comment
commentSchema.methods.isDislikedBy = function(userId) {
  return this.dislikes.some(dislike => dislike.user.toString() === userId.toString());
};

// Method to add like
commentSchema.methods.addLike = function(userId) {
  // Remove dislike if exists
  this.dislikes = this.dislikes.filter(
    dislike => dislike.user.toString() !== userId.toString()
  );
  
  // Add like if not already liked
  if (!this.isLikedBy(userId)) {
    this.likes.push({ user: userId });
  }
  
  return this.save();
};

// Method to add dislike
commentSchema.methods.addDislike = function(userId) {
  // Remove like if exists
  this.likes = this.likes.filter(
    like => like.user.toString() !== userId.toString()
  );
  
  // Add dislike if not already disliked
  if (!this.isDislikedBy(userId)) {
    this.dislikes.push({ user: userId });
  }
  
  return this.save();
};

// Method to remove like/dislike
commentSchema.methods.removeReaction = function(userId) {
  this.likes = this.likes.filter(
    like => like.user.toString() !== userId.toString()
  );
  this.dislikes = this.dislikes.filter(
    dislike => dislike.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Method to check if user can edit/delete
commentSchema.methods.canModify = function(userId) {
  return this.author.toString() === userId.toString();
};

// Transform comment data for response
commentSchema.methods.toJSON = function() {
  const commentObject = this.toObject();
  commentObject.likeCount = this.likeCount;
  commentObject.dislikeCount = this.dislikeCount;
  commentObject.engagementScore = this.engagementScore;
  return commentObject;
};

// Ensure virtuals are included in JSON
commentSchema.set('toJSON', { virtuals: true });
commentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Comment', commentSchema);
