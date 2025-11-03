import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String },
  fullName: { type: String },
});

export default mongoose.model("User", userSchema);
