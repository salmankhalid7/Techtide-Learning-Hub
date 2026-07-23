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

// Frequently queried when fetching modules of a course
moduleSchema.index({ course: 1 });

// Filter modules by workflow status
moduleSchema.index({ status: 1 });

// Support drag-and-drop ordering within a course
moduleSchema.index({ course: 1, order: 1 });

// Support scheduled publishing
moduleSchema.index({ releaseAt: 1 });

// Improve soft-delete queries
moduleSchema.index({ deletedAt: 1 });

const Module = mongoose.model("Module", moduleSchema);

export default Module;