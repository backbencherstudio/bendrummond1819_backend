import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Global error handler to be used in catch blocks
 * @param error 
 * @returns 
 */
export const handleError = (error: any) => {
  if (error instanceof HttpException) {
    return {
      success: false,
      message: error.getResponse(),
    };
  }

  return {
    success: false,
    message: error.message || 'Something went wrong',
  };
};

/**
 * Throws a formatted exception
 * @param message 
 * @param status 
 */
export const throwError = (message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) => {
  throw new HttpException(message, status);
};
