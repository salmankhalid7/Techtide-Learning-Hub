import mongoose from "mongoose";

const { Schema } = mongoose;

const moduleSchema = new Schema(
    {
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 150,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        order: {
            type: Number,
            required: true,
            min: 1,
        },

        status: {
            type: String,
            enum: ["draft", "published", "archived"],
            default: "draft",
        },

        isPreview: {
            type: Boolean,
            default: false,
        },

        isLocked: {
            type: Boolean,
            default: false,
        },

        estimatedDuration: {
            type: Number,
            min: 0,
            default: 0,
        },

        releaseAt: {
            type: Date,
            default: null,
        },

        stats: {
            lessonCount: {
                type: Number,
                default: 0,
                min: 0,
            },

            quizCount: {
                type: Number,
                default: 0,
                min: 0,
            },

            assignmentCount: {
                type: Number,
                default: 0,
                min: 0,
            },

            resourceCount: {
                type: Number,
                default: 0,
                min: 0,
            },

            totalDuration: {
                type: Number,
                default: 0,
                min: 0,
            },
        },

        ai: {
            generated: {
                type: Boolean,
                default: false,
            },

            generatedBy: {
                type: String,
                default: null,
                trim: true,
            },

            generatedAt: {
                type: Date,
                default: null,
            },
        },

        version: {
            type: Number,
            default: 1,
            min: 1,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

/**
 * -------------------------------------------------------
 * Database Indexes
 * -------------------------------------------------------
 */

// NOTE: the single-field `{ course: 1 }` index was removed (L2) — the
// `{ course: 1, order: 1 }` compound below has `course` as its leftmost prefix,
// so it serves every `course`-filtered query (including those that only filter
// by course) without a redundant standalone index.

// Filter modules by workflow status
moduleSchema.index({ status: 1 });

// Support drag-and-drop ordering within a course
moduleSchema.index({ course: 1, order: 1 });

// Support scheduled publishing
moduleSchema.index({ releaseAt: 1 });

// Improve soft-delete queries (platform-wide module count filters on deletedAt
// as the leading field — this index is used, do not remove).
moduleSchema.index({ deletedAt: 1 });
/**
 * -------------------------------------------------------
 * Virtual Properties
 * -------------------------------------------------------
 */

moduleSchema.virtual("isPublished").get(function () {
    return this.status === "published";
});

moduleSchema.virtual("isArchived").get(function () {
    return this.status === "archived";
});

moduleSchema.virtual("isDeleted").get(function () {
    return this.deletedAt !== null;
});

moduleSchema.virtual("isReleased").get(function () {
    return !this.releaseAt || this.releaseAt <= new Date();
});
/**
 * -------------------------------------------------------
 * Query Middleware
 * -------------------------------------------------------
 */

// Exclude soft-deleted modules from all find queries
moduleSchema.pre(/^find/, function () {
    this.where({ deletedAt: null });
});

/**
 * -------------------------------------------------------
 * Static Methods
 * -------------------------------------------------------
 */

/**
 * Find active modules of a course
 */
moduleSchema.statics.findByCourse = function (courseId) {
    return this.find({
        course: courseId,
        deletedAt: null,
    }).sort({ order: 1 });
};


/**
 * Find published modules of a course
 */
moduleSchema.statics.findPublishedByCourse = function (courseId) {
    return this.find({
        course: courseId,
        status: "published",
        deletedAt: null,
    }).sort({ order: 1 });
};

const Module = mongoose.model("Module", moduleSchema);

export default Module;