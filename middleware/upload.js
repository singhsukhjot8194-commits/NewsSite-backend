const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
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
