const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadToS3 } = require('../config/aws');

// Use Node.js built-in for UUID generation
const uuidv4 = () => crypto.randomUUID();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    csv: ['text/csv', 'application/vnd.ms-excel'],
  };

  const imageTypes = allowedTypes.image;
  const documentTypes = [...allowedTypes.document, ...allowedTypes.csv];
  const allTypes = [...imageTypes, ...documentTypes];

  // Check file type based on field name
  if (file.fieldname === 'avatar' || file.fieldname === 'logo' || file.fieldname === 'image') {
    if (!imageTypes.includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'), false);
    }
  } else if (file.fieldname === 'document' || file.fieldname === 'csv') {
    if (!documentTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false);
    }
  } else {
    if (!allTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false);
    }
  }

  cb(null, true);
};

// Memory storage for S3 upload
const memoryStorage = multer.memoryStorage();

// Configure multer
const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Max 5 files
  },
});

// Upload single file to S3
const uploadSingle = (fieldName, folder = 'uploads') => {
  return [
    upload.single(fieldName),
    async (req, res, next) => {
      try {
        if (!req.file) {
          return next();
        }

        // Generate unique filename
        const ext = path.extname(req.file.originalname);
        const filename = `${uuidv4()}${ext}`;
        req.file.originalname = filename;

        // Upload to S3
        const result = await uploadToS3(req.file, folder);
        req.fileUrl = result.cloudFrontUrl || result.location;
        req.fileKey = result.key;

        next();
      } catch (error) {
        next(error);
      }
    },
  ];
};

// Upload multiple files to S3
const uploadMultiple = (fieldName, maxCount = 5, folder = 'uploads') => {
  return [
    upload.array(fieldName, maxCount),
    async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) {
          return next();
        }

        const uploadPromises = req.files.map(async (file) => {
          const ext = path.extname(file.originalname);
          const filename = `${uuidv4()}${ext}`;
          file.originalname = filename;
          return uploadToS3(file, folder);
        });

        const results = await Promise.all(uploadPromises);
        req.fileUrls = results.map((r) => r.cloudFrontUrl || r.location);
        req.fileKeys = results.map((r) => r.key);

        next();
      } catch (error) {
        next(error);
      }
    },
  ];
};

// Upload fields to S3
const uploadFields = (fields, folder = 'uploads') => {
  return [
    upload.fields(fields),
    async (req, res, next) => {
      try {
        if (!req.files) {
          return next();
        }

        req.uploadedFiles = {};

        for (const fieldName of Object.keys(req.files)) {
          const fieldFiles = req.files[fieldName];
          const fieldFolder = `${folder}/${fieldName}`;

          const uploadPromises = fieldFiles.map(async (file) => {
            const ext = path.extname(file.originalname);
            const filename = `${uuidv4()}${ext}`;
            file.originalname = filename;
            return uploadToS3(file, fieldFolder);
          });

          const results = await Promise.all(uploadPromises);
          req.uploadedFiles[fieldName] = results.map((r) => ({
            url: r.cloudFrontUrl || r.location,
            key: r.key,
          }));
        }

        next();
      } catch (error) {
        next(error);
      }
    },
  ];
};

// Handle multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field in upload.',
      });
    }
  }

  if (err.message.includes('file type')) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError,
};
