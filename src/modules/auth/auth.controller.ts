import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RegisterUserDto } from './dto/register-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import appConfig from '../../config/app.config';
import { AuthGuard } from '@nestjs/passport';
import { SWAGGER_AUTH } from 'src/common/swagger/swagger';
import { handleError } from '../../common/helper/error-handler.helper';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResendVerificationEmailDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { UpdateSwaggerDto } from './dto/update-swagger.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Get user details' })
  @ApiBearerAuth(SWAGGER_AUTH.user)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    try {
      const user_id = req.user.userId;

      const response = await this.authService.me(user_id);

      return response;
    } catch (error) {
      return handleError(error);
    }
  }

  @ApiOperation({ summary: 'Register a user' })
  @ApiBody({ type: RegisterUserDto })
  @Post('register')
  async create(@Body() data: RegisterUserDto) {
    try {
      const name = data.name;
      const email = data.email;
      const phone = data.phone;
      const birthDate = data.birthDate;
      const password = data.password;

      if (!name) {
        throw new HttpException('Name not provided', HttpStatus.UNAUTHORIZED);
      }

      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const response = await this.authService.register({
        name,
        email,
        password,
        phone,
        birthDate,
      });

      return response;
    } catch (error) {
      return handleError(error);
    }
  }

  // login user
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request, @Res() res: Response) {
    try {
      const user_id = req.user.id;

      const user_email = req.user.email;

      const response = await this.authService.login({
        userId: user_id,
        email: user_email,
      });

      // store to secure cookies
      res.cookie('refresh_token', response.authorization.refresh_token, {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });

      res.json(response);
    } catch (error) {
      return handleError(error);
    }
  }

  @ApiOperation({ summary: 'Refresh token' })
  @ApiBearerAuth(SWAGGER_AUTH.user)
  @UseGuards(JwtAuthGuard)
  @Post('refresh-token')
  async refreshToken(@Req() req: Request, @Body() body: RefreshTokenDto) {
    try {
      const user_id = req.user.userId;

      const response = await this.authService.refreshToken(
        user_id,
        body.refresh_token,
      );

      return response;
    } catch (error) {
      return handleError(error);
    }
  }

  @ApiBearerAuth(SWAGGER_AUTH.user)
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    try {
      const userId = req.user.userId;
      const response = await this.authService.revokeRefreshToken(userId);
      return response;
    } catch (error) {
      return handleError(error);
    }
  }

  // @Get('google')
  // @UseGuards(AuthGuard('google'))
  // async googleLogin(): Promise<any> {
  //   return HttpStatus.OK;
  // }

  // @Get('google/redirect')
  // @UseGuards(AuthGuard('google'))
  // async googleLoginRedirect(@Req() req: Request): Promise<any> {
  //   return {
  //     statusCode: HttpStatus.OK,
  //     data: req.user,
  //   };
  // }

  // update user
  @ApiOperation({ summary: 'Update user' })
  @ApiBearerAuth(SWAGGER_AUTH.user)
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    }),
  )
  async updateUser(
    @Req() req: Request,
    @Body() data: UpdateSwaggerDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    try {
      const user_id = req.user.userId;
      const response = await this.authService.updateUser(user_id, data, image);
      return response;
    } catch (error) {
      return handleError(error);
    }
  }

  // --------------change password---------

  @ApiOperation({ summary: 'Forgot password' })
  @Post('forgot-password')
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.forgotPassword(email);
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  // verify email to verify the email
  @ApiOperation({ summary: 'Verify email' })
  @Post('verify-email')
  async verifyEmail(@Body() data: VerifyEmailDto) {
    try {
      const email = data.email;
      const token = data.token;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.verifyEmail({
        email: email,
        token: token,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to verify email',
      };
    }
  }

  // resend verification email to verify the email
  @ApiOperation({ summary: 'Resend verification email' })
  @Post('resend-verification-email')
  async resendVerificationEmail(@Body() data: ResendVerificationEmailDto) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.resendVerificationEmail(email);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to resend verification email',
      };
    }
  }

  // reset password if user forget the password
  @ApiOperation({ summary: 'Reset password' })
  @Post('reset-password')
  async resetPassword(@Body() data: ResetPasswordDto) {
    try {
      const email = data.email;
      const token = data.token;
      const password = data.password;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return await this.authService.resetPassword({
        email: email,
        token: token,
        password: password,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  // change password if user want to change the password
  @ApiOperation({ summary: 'Change password' })
  @ApiBearerAuth(SWAGGER_AUTH.user)
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Req() req: Request, @Body() data: ChangePasswordDto) {
    try {
      // const email = data.email;
      const user_id = req.user.userId;

      const oldPassword = data.old_password;
      const newPassword = data.new_password;
      // if (!email) {
      //   throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      // }
      if (!oldPassword) {
        throw new HttpException(
          'Old password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!newPassword) {
        throw new HttpException(
          'New password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return await this.authService.changePassword({
        // email: email,
        user_id: user_id,
        oldPassword: oldPassword,
        newPassword: newPassword,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to change password',
      };
    }
  }

  // --------------end change password---------

  // -------change email address------
  // @ApiOperation({ summary: 'request email change' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Post('request-email-change')
  // async requestEmailChange(
  //   @Req() req: Request,
  //   @Body() data: { email: string },
  // ) {
  //   try {
  //     const user_id = req.user.userId;
  //     const email = data.email;
  //     if (!email) {
  //       throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
  //     }
  //     return await this.authService.requestEmailChange(user_id, email);
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Something went wrong',
  //     };
  //   }
  // }

  // @ApiOperation({ summary: 'Change email address' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Post('change-email')
  // async changeEmail(
  //   @Req() req: Request,
  //   @Body() data: { email: string; token: string },
  // ) {
  //   try {
  //     const user_id = req.user.userId;
  //     const email = data.email;

  //     const token = data.token;
  //     if (!email) {
  //       throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
  //     }
  //     if (!token) {
  //       throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
  //     }
  //     return await this.authService.changeEmail({
  //       user_id: user_id,
  //       new_email: email,
  //       token: token,
  //     });
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Something went wrong',
  //     };
  //   }
  // }
  // -------end change email address------

  // --------- 2FA ---------
  // @ApiOperation({ summary: 'Generate 2FA secret' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Post('generate-2fa-secret')
  // async generate2FASecret(@Req() req: Request) {
  //   try {
  //     const user_id = req.user.userId;
  //     return await this.authService.generate2FASecret(user_id);
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // @ApiOperation({ summary: 'Verify 2FA' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Post('verify-2fa')
  // async verify2FA(@Req() req: Request, @Body() data: { token: string }) {
  //   try {
  //     const user_id = req.user.userId;
  //     const token = data.token;
  //     return await this.authService.verify2FA(user_id, token);
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // @ApiOperation({ summary: 'Enable 2FA' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Post('enable-2fa')
  // async enable2FA(@Req() req: Request) {
  //   try {
  //     const user_id = req.user.userId;
  //     return await this.authService.enable2FA(user_id);
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // @ApiOperation({ summary: 'Disable 2FA' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Post('disable-2fa')
  // async disable2FA(@Req() req: Request) {
  //   try {
  //     const user_id = req.user.userId;
  //     return await this.authService.disable2FA(user_id);
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }
  // --------- end 2FA ---------
}
