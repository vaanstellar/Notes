const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1'
});
const LOCAL_ASSETS_FOLDER = '/tmp/';

const getFileFromBucket = async (Bucket, Key) => {
  const getObjectParams = new GetObjectCommand({
    Bucket,
    Key
  });
  try {
    const response = await s3.send(getObjectParams);
    return await response.Body.transformToString('utf-8');
  } catch (err) {
    throw err;
  }
};

const uploadFileToBucket = async (Bucket, Key, filedataObj) => {
  const putObjectParams = new PutObjectCommand({
    Body: filedataObj,
    Bucket,
    Key
  });

  try {
    const uploadedResult = await s3.send(putObjectParams);
    return uploadedResult;
  } catch (err) {
    throw err;
  }
};

const downloadPdfAssetsFromS3 = async (s3Bucket, folderPrefix) => {
  try {
    let params = new ListObjectsCommand({
      Bucket: s3Bucket,
      Delimiter: '/',
      Prefix: `${folderPrefix}/`
    });
    var objectKeys = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      var data = await s3.send(params);
      const s3DataKeys = data.Contents;
      for (let index = 0; index < s3DataKeys.length; index++) {
        const s3Object = s3DataKeys[index];
        if (s3Object.Size > 0) {
          const filename = path.basename(s3Object.Key);
          console.log(`Copying asset ${filename} from ${s3Bucket} to ${LOCAL_ASSETS_FOLDER}${filename}`);
          const fileReadParam = new GetObjectCommand({
            Bucket: s3Bucket,
            Key: s3Object.Key
          });
          const file = await fs.createWriteStream(`${LOCAL_ASSETS_FOLDER}${filename}`);
          await s3.send(fileReadParam).createReadStream().pipe(file);
          const fileExists = fs.existsSync(`${LOCAL_ASSETS_FOLDER}${filename}`);
          if (!fileExists) {
            throw new Error(`Unable to load assets from temp ${LOCAL_ASSETS_FOLDER}${filename}`);
          }
          console.log('File exists: ', fileExists);
        }
      }
      if (!data.IsTruncated) {
        break;
      }
      params.Marker = data.NextMarker;
    }
    return objectKeys;
  } catch (error) {
    console.error('Unable to load assets, using code default', error);
    throw error;
  }
};

module.exports = {
  getFileFromBucket,
  uploadFileToBucket,
  downloadPdfAssetsFromS3
};
