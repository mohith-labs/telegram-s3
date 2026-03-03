export const S3_XML_NAMESPACE = 'http://s3.amazonaws.com/doc/2006-03-01/';

export const S3_ERROR_CODES = {
  AccessDenied: { status: 403, message: 'Access Denied' },
  NoSuchBucket: { status: 404, message: 'The specified bucket does not exist' },
  NoSuchKey: { status: 404, message: 'The specified key does not exist' },
  BucketAlreadyExists: { status: 409, message: 'The requested bucket name is not available' },
  BucketAlreadyOwnedByYou: { status: 409, message: 'Your previous request to create the named bucket succeeded' },
  BucketNotEmpty: { status: 409, message: 'The bucket you tried to delete is not empty' },
  InvalidBucketName: { status: 400, message: 'The specified bucket is not valid' },
  EntityTooLarge: { status: 400, message: 'Your proposed upload exceeds the maximum allowed object size' },
  NoSuchUpload: { status: 404, message: 'The specified multipart upload does not exist' },
  InvalidPart: { status: 400, message: 'One or more of the specified parts could not be found' },
  InvalidPartOrder: { status: 400, message: 'The list of parts was not in ascending order' },
  SignatureDoesNotMatch: { status: 403, message: 'The request signature we calculated does not match the signature you provided' },
  MalformedXML: { status: 400, message: 'The XML you provided was not well-formed' },
  InternalError: { status: 500, message: 'We encountered an internal error. Please try again.' },
} as const;

export type S3ErrorCode = keyof typeof S3_ERROR_CODES;

export const DEFAULT_MAX_KEYS = 1000;
export const S3_REGION = 'us-east-1';
export const S3_SERVICE = 's3';
