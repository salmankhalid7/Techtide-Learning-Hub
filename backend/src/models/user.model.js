import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../config/env.config.js";
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "instructor", "admin"],
      default: "student",
    },

    provider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },

    googleId: {
      type: String,
      default: null,
    },

    githubId: {
      type: String,
      default: null,
    },

    avatar: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    // Email verification: hashed token + expiry (raw token is emailed; only
    // the hash is stored).
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },

    // Password reset: hashed token + expiry.
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },

    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ==========================================
// Indexes
// ==========================================

// `email` and `username` fields are `unique: true`, so mongoose auto-creates
// unique indexes for them — those cover every email/username lookup.

// Common query indexes (used by admin dashboard / user analytics queries).
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isDeleted: 1 });

// NOTE: `googleId` / `githubId` and `{ email: 1, isDeleted: 1 }` indexes were
// removed — there are no OAuth-provider lookups (`User.findOne({ googleId })`
// etc.) and no `email + isDeleted` queries in the codebase. The unique `email`
// index already serves all email lookups. If OAuth login is added later, add
// sparse unique indexes then:
//   userSchema.index({ googleId: 1 }, { sparse: true, unique: true });
//   userSchema.index({ githubId: 1 }, { sparse: true, unique: true });

// ==========================================
// Hooks
// ==========================================

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(
    this.password,
    config.security.bcryptSaltRounds
  );
});

// ==========================================
// Instance Methods
// ==========================================

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.toJSON = function () {
  const user = this.toObject();

  delete user.password;
  delete user.refreshToken;
  delete user.__v;

  return user;
};

userSchema.methods.isPasswordChangedAfter = function (jwtTimestamp) {
  if (!this.passwordChangedAt) {
    return false;
  }

  const changedTimestamp = Math.floor(
    this.passwordChangedAt.getTime() / 1000
  );

  return changedTimestamp > jwtTimestamp;
};

userSchema.methods.isOAuthUser = function () {
  return this.provider !== "local";
};

const User = mongoose.model("User", userSchema);

export default User;