const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// S3 Instance
const s3 = new AWS.S3();

// CloudFront URL helper
const getCloudFrontUrl = (key) => {
  if (process.env.AWS_CLOUDFRONT_URL) {
    return `${process.env.AWS_CLOUDFRONT_URL}/${key}`;
  }
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

// Upload file to S3
const uploadToS3 = async (file, folder = 'uploads') => {
  const key = `${folder}/${Date.now()}-${file.originalname}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'private',
  };

  const result = await s3.upload(params).promise();

  return {
    key: result.Key,
    location: result.Location,
    cloudFrontUrl: getCloudFrontUrl(result.Key),
  };
};

// Delete file from S3
const deleteFromS3 = async (key) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  };

  await s3.deleteObject(params).promise();
  return true;
};

// Generate signed URL for private files
const getSignedUrl = (key, expiresIn = 3600) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Expires: expiresIn,
  };

  return s3.getSignedUrl('getObject', params);
};

// List files in a folder
const listFiles = async (prefix) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Prefix: prefix,
  };

  const result = await s3.listObjectsV2(params).promise();
  return result.Contents;
};

module.exports = {
  s3,
  uploadToS3,
  deleteFromS3,
  getSignedUrl,
  getCloudFrontUrl,
  listFiles,
};
