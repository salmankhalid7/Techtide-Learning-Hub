// Application-wide constants centralized for consistency
const constants = {
  APP: {
    API_PREFIX: "/api",                 // global route prefix for API endpoints
  },

  ROLES: {
    ADMIN: "admin",
    INSTRUCTOR: "instructor",
    STUDENT: "student",
  },

  ACCOUNT_STATUS: {
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended",
    PENDING: "pending",
  },

  COURSE_STATUS: {
    DRAFT: "draft",
    PUBLISHED: "published",
    ARCHIVED: "archived",
  },

  ENROLLMENT_STATUS: {
    ACTIVE: "active",
    COMPLETED: "completed",
    DROPPED: "dropped",
    SUSPENDED: "suspended",
  },

  FILES: {
    MAX_FILE_SIZE: 10 * 1024 * 1024,         // 10 MB
    ALLOWED_IMAGE_TYPES: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],

    ALLOWED_DOCUMENT_TYPES: [
      "application/pdf",
    ],
    ALLOWED_VIDEO_TYPES: [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ],
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,

    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,

    INTERNAL_SERVER_ERROR: 500,
  },
};

export default constants;