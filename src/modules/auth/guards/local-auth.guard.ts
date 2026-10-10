import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard(
  'local',
) {
  canActivate(
    context: ExecutionContext,
  ) {
    return super.canActivate(context);
  }

  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ) {
    const request = context
      .switchToHttp()
      .getRequest();

    const {
      phone,
      password,
    } = request.body;

    if (!phone) {
      throw new BadRequestException({
        success: false,
        message: 'Phone number is required',
        code: 'PHONE_REQUIRED',
      });
    }

    if (!password) {
      throw new BadRequestException({
        success: false,
        message: 'Password is required',
        code: 'PASSWORD_REQUIRED',
      });
    }

    if (err) {
      throw err;
    }

    if (!user) {
      throw (
        info ||
        new UnauthorizedException({
          success: false,
          message:
            'Invalid phone number or password',
          code: 'INVALID_CREDENTIALS',
        })
      );
    }

    return user;
  }
}