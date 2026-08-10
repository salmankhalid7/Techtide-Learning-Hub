import mongoose from "mongoose";


const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    token: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


// Automatically remove expired tokens
refreshTokenSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

// Support fast lookup + revocation by user (password change, logout, token
// revocation). Without this, `updateMany({ user })` scans the whole collection.
refreshTokenSchema.index({ user: 1 });


const RefreshToken = mongoose.model(
  "RefreshToken",
  refreshTokenSchema
);


export default RefreshToken;