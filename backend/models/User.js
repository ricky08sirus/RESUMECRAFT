import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true // Primary lookup field - indexed for O(log n) queries
    },
    email: { 
      type: String,
      index: true, // Fast email lookups
      sparse: true // Only index non-null values
    },
    fullName: { 
      type: String,
      index: false // No index needed - rarely queried alone
    },
  },
  {
    timestamps: true, // Auto-creates createdAt & updatedAt
    collection: 'users', // Explicit collection name
    
    // Performance optimizations
    autoIndex: process.env.NODE_ENV !== 'production', // Disable auto-indexing in production
    
    // Efficient queries by default
    toJSON: { 
      virtuals: false, 
      versionKey: false // Remove __v field from responses
    },
    toObject: { 
      virtuals: false, 
      versionKey: false 
    }
  }
);

// ================================
// COMPOUND INDEXES for complex queries (if needed later)
// ================================
// userSchema.index({ email: 1, createdAt: -1 }); // Uncomment if you query by email + date
// userSchema.index({ fullName: 'text' }); // Uncomment for full-text search

// ================================
// QUERY OPTIMIZATION - Always use lean() for read-only operations
// ================================
userSchema.statics.findByClerkId = function(clerkId) {
  return this.findOne({ clerkId }).lean().exec();
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email }).lean().exec();
};

// ================================
// BULK OPERATIONS for scaling (batch user creation)
// ================================
userSchema.statics.createMany = function(usersData) {
  return this.insertMany(usersData, { 
    ordered: false, // Continue on duplicate key errors
    lean: true 
  });
};

// ================================
// PRE-SAVE HOOKS for data consistency
// ================================
userSchema.pre('save', function(next) {
  // Trim and normalize data
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.fullName) this.fullName = this.fullName.trim();
  next();
});

// ================================
// SCHEMA VALIDATION
// ================================
userSchema.path('email').validate(function(email) {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}, 'Invalid email format');

// ================================
// MONITORING & PERFORMANCE TRACKING
// ================================
if (process.env.NODE_ENV !== 'production') {
  userSchema.post('save', function(doc) {
    console.log(`✅ User saved: ${doc.clerkId}`);
  });
}

export default mongoose.model("User", userSchema);