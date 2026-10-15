import multer from 'multer';
import { ApiError } from '../utils/apiError.js';

// Memory storage keeps file buffer in memory
const storage = multer.memoryStorage();

// File filter to allow CSV / plain text files
const fileFilter = (req, file, cb) => {
  const isCsv =
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.mimetype === 'text/plain' ||
    file.originalname.toLowerCase().endsWith('.csv');

  if (isCsv) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Only CSV files (.csv) are allowed for upload.'), false);
  }
};

export const uploadCsv = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter
});
