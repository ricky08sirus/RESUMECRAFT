import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    email: { 
      type: String,
      index: true,
      sparse: true
    },
    fullName: { 
      type: String,
    },

    // 💰 Add these fields 👇
    credits: { 
      type: Number, 
      default: 0, 
      min: 0,
      index: true
    },

    payments: [
      {
        razorpay_order_id: { type: String, required: true },
        razorpay_payment_id: { type: String },
        amount: { type: Number },
        creditsAdded: { type: Number },
        status: { 
          type: String, 
          enum: ["created", "success", "failed", "refunded"], 
          default: "success" 
        },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    collection: "users",
    autoIndex: process.env.NODE_ENV !== "production",
    toJSON: { virtuals: false, versionKey: false },
    toObject: { virtuals: false, versionKey: false },
  }
);

// ================================
// STATIC METHODS
// ================================
userSchema.statics.findByClerkId = function (clerkId) {
  return this.findOne({ clerkId }).lean().exec();
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email }).lean().exec();
};

userSchema.statics.createMany = function (usersData) {
  return this.insertMany(usersData, { ordered: false, lean: true });
};

// ================================
// PRE-SAVE HOOKS
// ================================
userSchema.pre("save", function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.fullName) this.fullName = this.fullName.trim();
  next();
});

// ================================
// VALIDATION
// ================================
userSchema.path("email").validate(function (email) {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}, "Invalid email format");

// ================================
// LOGGING
// ================================
if (process.env.NODE_ENV !== "production") {
  userSchema.post("save", function (doc) {
    console.log(`✅ User saved: ${doc.clerkId}, Credits: ${doc.credits}`);
  });
}

export default mongoose.model("User", userSchema);
