import {
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import {
  NextFunction,
  Request,
  Response,
} from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const startTime = Date.now();

    const {
      method,
      originalUrl,
      ip,
    } = req;

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      this.logger.log(
        `${method} ${originalUrl} ${res.statusCode} - ${duration}ms - IP: ${ip}`,
      );
    });

    next();
  }
}