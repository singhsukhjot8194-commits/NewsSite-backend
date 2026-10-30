const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const ALLOWED_IMAGE_FIELDS = ["image", "banner", "images"];
const ALLOWED_VIDEO_FIELDS = ["video"];

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const isVideo = ALLOWED_VIDEO_FIELDS.includes(file.fieldname);
        return {
            folder: "newssite_uploads",
            resource_type: isVideo ? "video" : "image",
            public_id: `${file.fieldname}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            overwrite: true,
            use_filename: false,
            unique_filename: false,
            use_filename_as_display_name: true,
            use_asset_folder_as_public_id_prefix: false,
            type: "upload",
            allowed_formats: isVideo
                ? ["mp4", "webm", "mov"]
                : ["jpg", "jpeg", "png", "webp"]
        };
    }
});

function checkFileType(file, cb) {
    const isVideo = ALLOWED_VIDEO_FIELDS.includes(file.fieldname);
    const allowedTypes = isVideo
        ? {
            ".mp4": ["video/mp4"],
            ".webm": ["video/webm"],
            ".mov": ["video/quicktime"]
        }
        : {
            ".jpg": ["image/jpeg"],
            ".jpeg": ["image/jpeg"],
            ".png": ["image/png"],
            ".webp": ["image/webp"]
        };

    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = Object.prototype.hasOwnProperty.call(allowedTypes, extension)
        ? allowedTypes[extension]
        : null;

    if (allowedMimeTypes && allowedMimeTypes.includes(file.mimetype)) {
        return cb(null, true);
    }

    cb(new Error(isVideo
        ? "Only MP4, WebM, and MOV videos are allowed."
        : "Only JPEG, PNG, and WebP images are allowed."));
}

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB image limit
        files: 5
    },
    fileFilter: function (req, file, cb) {
        if (!ALLOWED_IMAGE_FIELDS.includes(file.fieldname) && !ALLOWED_VIDEO_FIELDS.includes(file.fieldname)) {
            return cb(new Error(`Unexpected file field: ${file.fieldname}`));
        }
        checkFileType(file, cb);
    }
});

module.exports = upload;
