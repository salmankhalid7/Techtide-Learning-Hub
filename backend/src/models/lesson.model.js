/**
 * @file lesson.model.js
 * @description Lesson model for LearnX AI LMS.
 */

import mongoose from "mongoose";
import { LESSON_TYPES, LESSON_STATUS } from "../constants/lesson.constants.js";

const { Schema } = mongoose;

/**
 * Resource sub-schema for downloadable materials.
 */
const lessonResourceSchema = new Schema(
    {
        title: {
            type: String,
            trim: true
        },

        fileUrl: String,

        fileType: String,

        fileSize: Number
    },
    {
        _id: false
    }
);

/**
 * Video content sub-schema.
 */
const videoContentSchema = new Schema(
    {
        url: { type: String, required: true },
        thumbnailUrl: String,
        duration: Number,
        provider: {
            type: String,
            enum: ["INTERNAL", "YOUTUBE", "VIMEO", "WISTIA", "CLOUDINARY"],
            default: "INTERNAL"
        },
        videoId: String,
        subtitlesUrl: String,
        transcript: String,
        allowDownload: { type: Boolean, default: false }
    },
    { _id: false }
);

/**
 * Text content sub-schema.
 */
const textContentSchema = new Schema(
    {
        body: { type: String, required: true },
        plainText: String
    },
    { _id: false }
);

/**
 * PDF content sub-schema.
 */
const pdfContentSchema = new Schema(
    {
        url: { type: String, required: true },
        pages: Number,
        allowDownload: { type: Boolean, default: true }
    },
    { _id: false }
);

/**
 * Audio content sub-schema.
 */
const audioContentSchema = new Schema(
    {
        url: { type: String, required: true },
        duration: Number,
        provider: {
            type: String,
            enum: ["INTERNAL", "SPOTIFY", "SOUNDCLOUD", "CLOUDINARY"],
            default: "INTERNAL"
        },
        transcript: String,
        allowDownload: { type: Boolean, default: false }
    },
    { _id: false }
);

/**
 * External link content sub-schema.
 */
const externalLinkContentSchema = new Schema(
    {
        url: { type: String, required: true },
        domain: String,
        embedUrl: String,
        openInNewTab: { type: Boolean, default: true }
    },
    { _id: false }
);

/**
 * Lesson Schema
 */
const lessonSchema = new Schema(
    {
        /**
         * Basic Information
         */
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: ""
        },

        /**
         * Relationships
         */
        module: {
            type: Schema.Types.ObjectId,
            ref: "Module",
            required: true,
            index: true
        },

        /**
         * Lesson Type
         */
        lessonType: {
            type: String,
            enum: LESSON_TYPES,
            required: true,
            index: true
        },

        /**
         * Lesson Content — typed sub-schemas based on lessonType.
         * The service layer selects the appropriate sub-schema at runtime.
         */
        content: {
            type: {
                type: String,
                enum: LESSON_TYPES,
                required: true
            },

            video: videoContentSchema,

            text: textContentSchema,

            pdf: pdfContentSchema,

            audio: audioContentSchema,

            externalLink: externalLinkContentSchema
        },

        /**
         * Downloadable Resources
         */
        resources: [lessonResourceSchema],

        /**
         * Lesson Ordering
         */
        order: {
            type: Number,
            required: true,
            min: 1
        },

        /**
         * Estimated Duration (Seconds)
         */
        duration: {
            type: Number,
            default: 0,
            min: 0
        },

        /**
         * Publishing Workflow
         */
        status: {
            type: String,
            enum: LESSON_STATUS,
            default: "DRAFT",
            index: true
        },

        /**
         * Access Control
         */
        isPreview: {
            type: Boolean,
            default: false
        },

        isLocked: {
            type: Boolean,
            default: false
        },

        /**
         * Scheduled Release
         */
        releaseAt: {
            type: Date,
            default: null
        },

        /**
         * AI Metadata
         */
        aiMetadata: {
            generated: {
                type: Boolean,
                default: false
            },

            provider: String,

            model: String,

            generatedAt: Date
        },

        /**
         * Analytics
         */
        analytics: {
            views: {
                type: Number,
                default: 0
            },

            completions: {
                type: Number,
                default: 0
            }
        },

        /**
         * Versioning
         */
        version: {
            type: Number,
            default: 1
        },

        /**
         * Soft Delete
         */
        isDeleted: {
            type: Boolean,
            default: false,
            index: true
        },

        deletedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

lessonSchema.index({ slug: 1 }, { unique: true });

lessonSchema.index(
    { module: 1, order: 1 },
    { unique: true }
);

lessonSchema.index({ releaseAt: 1 });

lessonSchema.index({
    title: "text",
    description: "text"
});

/*
|--------------------------------------------------------------------------
| Virtuals
|--------------------------------------------------------------------------
*/

lessonSchema.virtual("resourceCount").get(function () {
    return this.resources.length;
});

lessonSchema.virtual("isReleased").get(function () {
    if (!this.releaseAt) return true;

    return this.releaseAt <= new Date();
});

lessonSchema.virtual("estimatedReadingTime").get(function () {
    if (this.lessonType !== "TEXT") return null;

    const words =
        this.content?.text?.body?.split(/\s+/).length ||
        this.content?.text?.plainText?.split(/\s+/).length ||
        0;

    return Math.ceil(words / 200);
});

/*
|--------------------------------------------------------------------------
| Query Middleware
|--------------------------------------------------------------------------
*/

lessonSchema.pre(/^find/, function (next) {
    this.where({
        isDeleted: false
    });

    next();
});

/*
|--------------------------------------------------------------------------
| Static Methods
|--------------------------------------------------------------------------
*/

lessonSchema.statics.findPublished = function () {
    return this.find({
        status: "PUBLISHED"
    });
};

lessonSchema.statics.findByModule = function (moduleId) {
    return this.find({
        module: moduleId
    }).sort({
        order: 1
    });
};

/*
|--------------------------------------------------------------------------
| Instance Methods
|--------------------------------------------------------------------------
*/

lessonSchema.methods.isPublished = function () {
    return this.status === "PUBLISHED";
};

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

const Lesson = mongoose.model("Lesson", lessonSchema);

export { LESSON_TYPES, LESSON_STATUS };

export default Lesson;