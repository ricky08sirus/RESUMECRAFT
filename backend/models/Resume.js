// models/Resume.js - Ultra-Scalable, Safe Version (with Razorpay Payment Integration)
import mongoose from "mongoose";

/* -------------------------------------------------------------------------- */
/*                           SUB-SCHEMAS (Optimized)                          */
/* -------------------------------------------------------------------------- */

// Resume Customization (Job-specific tailored versions)
const customizedVersionSchema = new mongoose.Schema({
  jobId: { type: String, required: true },
  jobDescription: { type: String, required: false },
  customizedText: { type: String },
  matchScore: { type: Number, min: 0, max: 100, index: true },
  shortlistChance: { type: Number, min: 0, max: 100, index: true },
  analysisSummary: { type: String },
  matchInsights: {
    strengths: [String],
    weaknesses: [String],
    recommendations: [String],
  },
  error: { type: String },
}, { timestamps: true, _id: true });

// LinkedIn Teaser (Lightweight for fast queries)
const teaserSchema = new mongoose.Schema({
  jobId: { type: String, required: true },
  message: { type: String },
  error: { type: String },
}, { timestamps: true, _id: true });

/* -------------------------------------------------------------------------- */
/*                          PAYMENT SUB-SCHEMA (Razorpay)                     */
/* -------------------------------------------------------------------------- */

const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true, index: true },
  paymentId: { type: String, index: true },
  signature: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  status: { 
    type: String, 
    enum: ["created", "paid", "failed", "refunded"], 
    default: "created",
    index: true 
  },
  creditsAdded: { type: Number, default: 0 },
  paymentMethod: { type: String },
  razorpayResponse: { type: Object },
  verifiedAt: { type: Date },
  error: { type: String },
}, { timestamps: true, _id: true });

/* -------------------------------------------------------------------------- */
/*                               MAIN SCHEMA                                  */
/* -------------------------------------------------------------------------- */

const resumeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true
  },

  fileName: { type: String, required: true },
  originalName: { type: String },
  filePath: { type: String },
  fileSize: { type: Number },
  fileType: { type: String },
  r2Url: { type: String },
  r2Key: { type: String },

  source: { 
    type: String, 
    enum: ["upload", "linkedin", "ai_generated"], 
    default: "upload",
    index: true
  },

  status: {
    type: String,
    enum: ["queued", "processing", "completed", "failed"],
    default: "queued",
    index: true
  },

  parsedText: { type: String },
  extractionMethod: { type: String },
  atsScore: { type: Number, min: 0, max: 100, index: true },
  atsDetails: { type: Object },
  wordCount: { type: Number },

  jobDescription: { type: String },
  jdAnalysis: { type: Object },
  matchScore: { type: Number, min: 0, max: 100, index: true },
  shortlistChance: { type: Number, min: 0, max: 100, index: true },
  matchInsights: {
    strengths: [String],
    weaknesses: [String],
    recommendations: [String],
  },

  customizedVersions: [customizedVersionSchema],
  teasers: [teaserSchema],
  payments: [paymentSchema], // 💰 Razorpay integrated payment records

  createdAt: { type: Date, default: Date.now, index: true },
  processingStartedAt: { type: Date },
  processedAt: { type: Date, index: true },
  failedAt: { type: Date },
  error: { type: String },
}, { 
  timestamps: true,
  strict: true,
  strictQuery: false,
  autoIndex: true,
  minimize: false,
});

/* -------------------------------------------------------------------------- */
/*                               INDEX DEFINITIONS                             */
/* -------------------------------------------------------------------------- */

resumeSchema.index({ userId: 1, createdAt: -1 });
resumeSchema.index({ userId: 1, status: 1, createdAt: -1 });
resumeSchema.index({ userId: 1, status: 1, processedAt: -1 });
resumeSchema.index({ "customizedVersions.jobId": 1 }, { sparse: true });
resumeSchema.index({ "teasers.jobId": 1 }, { sparse: true });
resumeSchema.index({ status: 1, createdAt: -1 });
resumeSchema.index({ atsScore: -1, createdAt: -1 });
resumeSchema.index({ r2Key: 1 }, { sparse: true, unique: true });
resumeSchema.index({ "payments.orderId": 1 }, { sparse: true });
resumeSchema.index({ "payments.status": 1, "payments.createdAt": -1 });

/* -------------------------------------------------------------------------- */
/*                              STATIC METHODS                                 */
/* -------------------------------------------------------------------------- */

resumeSchema.statics.getUserResumes = function(userId, limit = 20, skip = 0) {
  return this.find({ userId })
    .select('fileName status atsScore createdAt processedAt fileSize')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean()
    .exec();
};

resumeSchema.statics.getResumeWithCustomizations = function(resumeId, userId) {
  return this.findOne({ _id: resumeId, userId })
    .select('-parsedText')
    .lean()
    .exec();
};

resumeSchema.statics.getTeaserByJobId = function(jobId) {
  return this.findOne(
    { "teasers.jobId": jobId },
    { "teasers.$": 1 }
  ).lean().exec();
};

resumeSchema.statics.getCustomizationByJobId = function(jobId) {
  return this.findOne(
    { "customizedVersions.jobId": jobId },
    { "customizedVersions.$": 1 }
  ).lean().exec();
};

/* -------------------------------------------------------------------------- */
/*                              INSTANCE METHODS                               */
/* -------------------------------------------------------------------------- */

// Add new customized version (Safe)
resumeSchema.methods.addCustomization = async function(customizationData) {
  if (!customizationData.jobDescription && this.jobDescription) {
    customizationData.jobDescription = this.jobDescription;
  }

  if (!customizationData.jobId) {
    customizationData.jobId = new mongoose.Types.ObjectId().toString();
  }

  this.customizedVersions.push(customizationData);
  return this.save({ validateBeforeSave: false });
};

// Add new teaser (Safe)
resumeSchema.methods.addTeaser = async function(teaserData) {
  if (!teaserData.jobId) {
    teaserData.jobId = new mongoose.Types.ObjectId().toString();
  }
  this.teasers.push(teaserData);
  return this.save({ validateBeforeSave: false });
};

// 💰 Add new payment (Safe)
resumeSchema.methods.addPayment = async function(paymentData) {
  if (!paymentData.orderId) {
    throw new Error("orderId is required to create payment record.");
  }
  this.payments.push(paymentData);
  return this.save({ validateBeforeSave: false });
};

// 💰 Update payment after verification
resumeSchema.methods.updatePaymentStatus = async function(orderId, updateData) {
  const payment = this.payments.find(p => p.orderId === orderId);
  if (payment) {
    Object.assign(payment, updateData);
    return this.save({ validateBeforeSave: false });
  }
  throw new Error("Payment not found for orderId: " + orderId);
};

/* -------------------------------------------------------------------------- */
/*                               MIDDLEWARE                                    */
/* -------------------------------------------------------------------------- */

resumeSchema.pre('save', function(next) {
  if (this.customizedVersions?.length > 50) {
    this.customizedVersions = this.customizedVersions.slice(-50);
  }
  if (this.teasers?.length > 30) {
    this.teasers = this.teasers.slice(-30);
  }
  if (this.payments?.length > 100) {
    this.payments = this.payments.slice(-100);
  }
  next();
});

resumeSchema.post('init', function(doc) {
  if (doc.customizedVersions) doc._customizationCount = doc.customizedVersions.length;
  if (doc.teasers) doc._teaserCount = doc.teasers.length;
  if (doc.payments) doc._paymentCount = doc.payments.length;
});

/* -------------------------------------------------------------------------- */
/*                              OUTPUT OPTIMIZATION                            */
/* -------------------------------------------------------------------------- */

resumeSchema.set('toJSON', { 
  virtuals: false,
  versionKey: false,
  transform: function(doc, ret) {
    if (ret.parsedText && typeof ret.parsedText === 'string' && ret.parsedText.length > 1000) {
      ret.parsedText = ret.parsedText.substring(0, 1000) + '... [truncated]';
    }
    return ret;
  }
});

/* -------------------------------------------------------------------------- */
/*                            QUERY PERFORMANCE LOGS                           */
/* -------------------------------------------------------------------------- */

if (process.env.ENABLE_QUERY_LOGGING === 'true') {
  resumeSchema.pre(/^find/, function(next) {
    this._startTime = Date.now();
    next();
  });
  resumeSchema.post(/^find/, function(result, next) {
    console.log(`📊 Query executed:`, {
      filter: this.getQuery(),
      duration: Date.now() - this._startTime
    });
    next();
  });
}

/* -------------------------------------------------------------------------- */
/*                               EXPORT MODEL                                  */
/* -------------------------------------------------------------------------- */

export default mongoose.model("Resume", resumeSchema);
