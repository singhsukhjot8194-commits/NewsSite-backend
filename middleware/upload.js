const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'newssite_uploads';
    let resource_type = 'auto'; // let cloudinary auto-detect, but we can be explicit
    
    if (file.fieldname === 'video') {
      resource_type = 'video';
    } else {
      resource_type = 'image';
    }
    
    return {
      folder: folder,
      resource_type: resource_type,
      public_id: `${file.fieldname}-${Date.now()}`,
    };
  },
});

function checkFileType(file, cb) {
  const allowedTypes = file.fieldname === 'video'
    ? {
      '.mp4': ['video/mp4'],
      '.webm': ['video/webm'],
      '.mov': ['video/quicktime']
    }
    : {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.webp': ['image/webp']
    };
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = Object.prototype.hasOwnProperty.call(allowedTypes, extension)
    ? allowedTypes[extension]
    : null;

  if (allowedMimeTypes && allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  cb(new Error(file.fieldname === 'video'
    ? 'Only MP4, WebM, and MOV videos are allowed.'
    : 'Only JPEG, PNG, and WebP images are allowed.'));
}

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = upload;
