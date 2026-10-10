// external imports
import { 
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  HttpException,
  HttpStatus,
 } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { MailService } from '../../mail/mail.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../common/helper/date.helper';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { StringHelper } from '../../common/helper/string.helper';
import { Prisma } from 'prisma/generated/client';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { TwilioVerifyService } from 'src/twilio/twilio-verify.service';
import { 
  parsePhoneNumberFromString,
  CountryCode,
 } from 'libphonenumber-js';

import * as bcrypt from 'bcrypt';

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  countryCode: CountryCode;
  phone: string;
  birthDate?: Date;
  type?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    private userRepository: UserRepository,
    private ucodeRepository: UcodeRepository,
    private twilioVerifyService: TwilioVerifyService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private static readonly PHONE_OTP_RESEND_COOLDOWN_SECONDS = 30;

  async me(userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          address: true,
          country: true,
          state: true,
          city: true,
          zip_code: true,
          phone_number: true,
          bill_remainders: true,
          notification_remainder: true,
          email_updates: true,
          type: true,
          gender: true,
          date_of_birth: true,
          created_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + '/' + user.avatar,
        );
      }

      if (user) {
        return {
          success: true,
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    image?: Express.Multer.File | null,
  ) {
    const current = await this.prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true, avatar: true, email: true, phone_number: true },
    });
    if (!current) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};
    for (const field of ['name', 'country', 'state', 'city', 'address', 'zip_code', 'gender',
      'bill_remainders', 'notification_remainder', 'email_updates'] as const) {
      if (dto[field] !== undefined) (data as Record<string, unknown>)[field] = dto[field];
    }
    if (dto.email !== undefined) {
      data.email = dto.email;
      if (dto.email !== current.email) data.email_verified_at = null;
    }
    if (dto.phone_number !== undefined) {
      data.phone_number = this.normalizePhoneNumber(dto.phone_number);
      if (data.phone_number !== current.phone_number) {
        data.phone_verified_at = null;
        data.phone_otp_last_sent_at = null;
      }
    }
    if (dto.date_of_birth !== undefined) {
      const date = new Date(dto.date_of_birth.slice(0, 10) + 'T00:00:00.000Z');
      if (!Number.isFinite(date.getTime()) || date > new Date()) {
        throw new BadRequestException('Date of birth must be a valid date in the past');
      }
      data.date_of_birth = date;
    }
    if (!image && Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one profile field, setting or image');
    }

    let newImage: string | undefined;
    let saved = false;
    const avatarKey = (name: string) => `${appConfig().storageUrl.avatar}/${name}`;
    const cleanup = async (name: string) => {
      try { await SojebStorage.delete(avatarKey(name)); }
      catch { new Logger(AuthService.name).warn('Could not clean up profile image'); }
    };
    try {
      if (image) {
        const buffer = image.buffer;
        const jpeg = buffer?.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
        const png = buffer?.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const webp = buffer?.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
        const extension = jpeg && image.mimetype === 'image/jpeg' ? 'jpg'
          : png && image.mimetype === 'image/png' ? 'png'
          : webp && image.mimetype === 'image/webp' ? 'webp' : undefined;
        if (!extension || buffer.length > 5 * 1024 * 1024) {
          throw new BadRequestException('Upload a valid JPEG, PNG or WebP image up to 5 MB');
        }
        newImage = `${randomUUID()}.${extension}`;
        await SojebStorage.put(avatarKey(newImage), buffer);
        if (!await SojebStorage.isExists(avatarKey(newImage))) {
          throw new InternalServerErrorException('Profile image upload failed');
        }
        data.avatar = newImage;
      }
      const user = await this.prisma.user.update({
        where: { id: userId }, data: { ...data, updated_at: new Date() },
        select: {
          id: true, name: true, email: true, phone_number: true, date_of_birth: true,
          avatar: true, country: true, state: true, city: true, address: true,
          zip_code: true, gender: true, bill_remainders: true,
          notification_remainder: true, email_updates: true,
        },
      });
      saved = true;
      if (newImage && current.avatar && current.avatar !== newImage) await cleanup(current.avatar);
      return {
        success: true, message: 'User updated successfully',
        data: { ...user, avatar_url: user.avatar ? SojebStorage.url(avatarKey(user.avatar)) : null },
      };
    } catch (error) {
      if (newImage && !saved) await cleanup(newImage);
      if (error.code === 'P2002') throw new ConflictException('Email or phone number is already in use');
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      throw error;
    }
  }

 async validateUser(
    phone: string,
    password: string,
  ) {
    const parsedPhone = parsePhoneNumberFromString(
      phone.trim(),
    );

    if (!parsedPhone || !parsedPhone.isValid()) {
      throw new UnauthorizedException(
        'Invalid phone number or password',
      );
    }

    const normalizedPhone = parsedPhone.number;

    const user = await this.prisma.user.findUnique({
      where: {
        phone_number: normalizedPhone,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid phone number or password',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Invalid phone number or password',
      );
    }

    if (!user.phone_verified_at) {
      throw new ForbiddenException({
        success: false,
        message:
          'Please verify your phone number before logging in.',
        code: 'PHONE_NOT_VERIFIED',
      });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      type: user.type,
    };
  }

  async login({
    userId,
  }: {
    userId: string;
  }) {
    const user =
      await this.userRepository.getUserDetails(
        userId,
      );

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    const payload = {
      sub: user.id,
    };

    const accessToken =
      this.jwtService.sign(payload, {
        expiresIn: '1h',
      });

    const refreshToken =
      this.jwtService.sign(payload, {
        expiresIn: '7d',
      });

    // Store refresh token for 7 days
    await this.redis.set(
      `refresh_token:${user.id}`,
      refreshToken,
      'EX',
      60 * 60 * 24 * 7,
    );

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Logged in successfully',
      authorization: {
        type: 'bearer',
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      type: user.type,
    };
  }

  async refreshToken(user_id: string, refreshToken: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userDetails = await this.userRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  private normalizePhoneNumber(
    input: string,
    countryCode?: CountryCode,
  ): string {
    const raw = input.trim();

    const phone = raw.startsWith('+')
      ? parsePhoneNumberFromString(raw)
      : countryCode
        ? parsePhoneNumberFromString(raw, countryCode)
        : undefined;

    if (!phone || !phone.isValid()) {
      throw new BadRequestException(
        'Invalid phone number. Please provide a valid phone number and country.',
      );
    }

    return phone.number;
  }
  // async register({
  //   name,
  //   email,
  //   phone,
  //   birthDate,
  //   password,
  //   type = 'user',
  // }: {
  //   name: string;
  //   email: string;
  //   password: string;
  //   phone: string;
  //   birthDate?: Date;
  //   type?: string;
  // }) {
  //   try {
  //     // Check if email already exist
  //     const userEmailExist = await this.userRepository.exist({
  //       field: 'email',
  //       value: String(email),
  //     });

  //     if (userEmailExist) {
  //       return {
  //         statusCode: 401,
  //         message: 'Email already exist',
  //       };
  //     }

  //     const normalizedPhone = this.normalizePhoneNumber(phone);

  //     const phoneExists = await this.userRepository.exist({
  //       field: 'phone_number',
  //       value: normalizedPhone,
  //     });

  //     if (phoneExists) {
  //       throw new ConflictException('Phone number already exists');
  //     }

  //     const user = await this.userRepository.createUser({
  //       name,
  //       email,
  //       password,
  //       phone_number: normalizedPhone,
  //       birthDate: birthDate,
  //       type,
  //     });

  //     if (user == null || user.success == false) {
  //       return {
  //         success: false,
  //         message: 'Failed to create account',
  //       };
  //     }

  //     try {
  //       await this.twilioVerifyService.sendSms(normalizedPhone);
  //     } catch (error) {

  //       await this.userRepository.deleteUser(user.data.id);

  //       throw error;
  //     }

  //     // create stripe customer account
  //     const stripeCustomer = await StripePayment.createCustomer({
  //       user_id: user.data.id,
  //       email: email,
  //       name: name,
  //     });

  //     if (stripeCustomer) {
  //       await this.prisma.user.update({
  //         where: {
  //           id: user.data.id,
  //         },
  //         data: {
  //           billing_id: stripeCustomer.id,
  //         },
  //       });
  //     }

  //     // ----------------------------------------------------
  //     // // create otp code
  //     // const token = await this.ucodeRepository.createToken({
  //     //   userId: user.data.id,
  //     //   isOtp: true,
  //     // });

  //     // // send otp code to email
  //     // await this.mailService.sendOtpCodeToEmail({
  //     //   email: email,
  //     //   name: name,
  //     //   otp: token,
  //     // });

  //     // return {
  //     //   success: true,
  //     //   message: 'We have sent an OTP code to your email',
  //     // };

  //     // ----------------------------------------------------

  //     // Generate verification token
  //     // const token = await this.ucodeRepository.createVerificationToken({
  //     //   userId: user.data.id,
  //     //   email: email,
  //     // });

  //     // Send verification email with token
  //     // await this.mailService.sendVerificationLink({
  //     //   email,
  //     //   name: email,
  //     //   token: token.token,
  //     //   type: type,
  //     // });

  //     // create otp code
  //     const token = await this.ucodeRepository.createToken({
  //       userId: user.data.id,
  //       isOtp: true,
  //     });

  //     // console.log(token);

  //     // send otp code to email
  //     // await this.mailService.sendOtpCodeToEmail({
  //     //   email: user.data.email,
  //     //   name: user.data.name,
  //     //   otp: token,
  //     // });

  //     return {
  //       success: true,
  //       message: 'Verification code sent to your mobile number',
  //       nextStep: 'VERIFY_PHONE',
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error,
  //     };
  //   }
  // }

  async resendPhoneVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        phone_number: true,
        phone_verified_at: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.phone_verified_at) {
      return {
        success: true,
        message: 'Phone number is already verified',
        nextStep: 'COMPLETED',
      };
    }

    if (!user.phone_number) {
      throw new BadRequestException(
        'No phone number is associated with this account',
      );
    }

    await this.twilioVerifyService.sendSms(
      user.phone_number,
    );

      return {
        success: true,
        message:
          'Verification code sent to your mobile number',
        nextStep: 'VERIFY_PHONE',
      };
    }
    
  async register({
    name,
    email,
    phone,
    countryCode,
    birthDate,
    password,
    type = 'user',
  }: RegisterInput) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = this.normalizePhoneNumber(phone, countryCode);

    // Check email
    const emailExists = await this.userRepository.exist({
      field: 'email',
      value: normalizedEmail,
    });

    if (emailExists) {
      throw new ConflictException('Email already exists');
    }

    // Check phone
    const phoneExists = await this.userRepository.exist({
      field: 'phone_number',
      value: normalizedPhone,
    });

    if (phoneExists) {
      throw new ConflictException('Phone number already exists');
    }

    // Create user first.
    //
    // Ideally the user should be created as:
    // status: PENDING
    // phone_verified_at: null
    const user = await this.userRepository.createUser({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone_number: normalizedPhone,
      birthDate,
      type,
    });

    if (!user?.success || !user.data) {
      throw new InternalServerErrorException(
        'Failed to create account',
      );
    }

    const userId = user.data.id;
    try {
      const stripeCustomer =
        await StripePayment.createCustomer({
          user_id: userId,
          email: normalizedEmail,
          name: name.trim(),
        });

      if (stripeCustomer?.id) {
        await this.prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            billing_id: stripeCustomer.id,
          },
        });
      }
    } catch (error) {
      // Replace with Pino/Winston logger in production.
      console.error(
        `Failed to create Stripe customer for user ${userId}`,
        error,
      );
    }

    /*
     * Send phone verification OTP.
     *
     * Important:
     * We do NOT delete the user when Twilio fails.
     * The user remains pending/unverified and can request
     * another OTP later.
     */
    try {
      await this.twilioVerifyService.sendSms(
        normalizedPhone,
      );
    } catch (error) {
      console.error(
        `Failed to send verification SMS for user ${userId}`,
        error,
      );

      return {
        success: true,
        message:
          'Account created, but we could not send the verification code. Please request a new code.',
        nextStep: 'RESEND_PHONE_VERIFICATION',
        data: {
          userId,
          phone: normalizedPhone,
          phoneVerified: false,
        },
      };
    }

    return {
      success: true,
      message:
        'Account created successfully. Verification code sent to your mobile number.',
      nextStep: 'VERIFY_PHONE',
      data: {
        userId,
        phone: normalizedPhone,
        phoneVerified: false,
      },
    };
  }

  private async generateAccessToken(user: {
    id: string;
    phone_number?: string | null;
  }): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      phone_number: user.phone_number,
    });
  }

  async verifyPhone(
    userId: string,
    code: string,
  ) {
    const user =
      await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.phone_number) {
      throw new BadRequestException({
        success: false,
        message:
          'Phone number is not associated with this account',
        code: 'PHONE_NOT_FOUND',
      });
    }

    if (user.phone_verified_at) {
      throw new ConflictException({
        success: false,
        message: 'Phone number is already verified',
        code: 'PHONE_ALREADY_VERIFIED',
      });
    }

    const verification =
      await this.twilioVerifyService.verifySms(
        user.phone_number,
        code,
      );

    if (
      !verification.success ||
      verification.status !== 'approved'
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Invalid or expired verification code',
        code: 'OTP_INVALID',
      });
    }

    const verifiedUser =
      await this.userRepository.markPhoneAsVerified(
        user.id,
      );

    const accessToken =
      await this.generateAccessToken(verifiedUser);

    return {
      success: true,
      message:
        'Phone number verified successfully',
      accessToken,
      user: {
        id: verifiedUser.id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        phone: verifiedUser.phone_number,
        phoneVerified: true,
      },
    };
  }

  async resendPhoneOtp(userId: string) {
    const user =
      await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.phone_number) {
      throw new BadRequestException({
        success: false,
        message:
          'Phone number is not associated with this account',
        code: 'PHONE_NOT_FOUND',
      });
    }

    if (user.phone_verified_at) {
      throw new ConflictException({
        success: false,
          message: 'Phone number is already verified',
          code: 'PHONE_ALREADY_VERIFIED',
        });
      }

      const cooldownSeconds =
        AuthService.PHONE_OTP_RESEND_COOLDOWN_SECONDS;

      const now = new Date();

      /*
      * Prevent repeated SMS requests.
      */
      if (user.phone_otp_last_sent_at) {
        const elapsedSeconds = Math.floor(
          (now.getTime() -
            user.phone_otp_last_sent_at.getTime()) /
            1000,
        );

        if (elapsedSeconds < cooldownSeconds) {
          const retryAfter =
            cooldownSeconds - elapsedSeconds;

          throw new HttpException(
            {
              success: false,
              message: `Please wait ${retryAfter} seconds before requesting another verification code.`,
              code: 'OTP_RESEND_COOLDOWN',
              retryAfter,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      /*
      * Claim the resend slot atomically.
      *
      * This prevents two simultaneous API requests
      * from sending two SMS messages.
      */
      const eligibleBefore = new Date(
        now.getTime() - cooldownSeconds * 1000,
      );

      const claim =
        await this.prisma.user.updateMany({
          where: {
            id: user.id,
            phone_verified_at: null,

            OR: [
              {
                phone_otp_last_sent_at: null,
              },
              {
                phone_otp_last_sent_at: {
                  lte: eligibleBefore,
                },
              },
            ],
          },

          data: {
            phone_otp_last_sent_at: now,
          },
        });

      /*
      * Another request may have claimed the resend
      * window between our SELECT and UPDATE.
      */
      if (claim.count === 0) {
        throw new HttpException(
          {
            success: false,
            message:
              'Please wait before requesting another verification code.',
            code: 'OTP_RESEND_COOLDOWN',
            retryAfter: cooldownSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      /*
      * Important:
      * Use the phone stored in the database.
      */
      const verification =
        await this.twilioVerifyService.sendSms(
          user.phone_number,
        );

      return {
        success: true,
        message:
          'Verification code sent successfully',
        nextStep: 'VERIFY_PHONE',

        data: {
          userId: user.id,
          phone:
            this.maskPhoneNumber(
              user.phone_number,
            ),
          phoneVerified: false,
          resendAvailableIn:
            cooldownSeconds,
          status: verification.status,
        },
      };
  }
  
  private maskPhoneNumber(
    phoneNumber: string,
  ): string {
    if (!phoneNumber) {
      return '';
    }

    if (phoneNumber.length <= 7) {
      return '***';
    }

    return `${phoneNumber.slice(
      0,
      4,
    )}*****${phoneNumber.slice(-3)}`;
  } 

  async forgotPassword(
    phone: string,
  ) {
    const parsedPhone =
      parsePhoneNumberFromString(
        phone.trim(),
      );

    if (
      !parsedPhone ||
      !parsedPhone.isValid()
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Invalid phone number',
        code: 'INVALID_PHONE_NUMBER',
      });
    }

    const normalizedPhone =
      parsedPhone.number;

    const user =
      await this.prisma.user.findUnique({
        where: {
          phone_number:
            normalizedPhone,
        },
      });

    if (!user) {
      /*
      * Better security:
      * don't reveal whether phone exists.
      */
      return {
        success: true,
        message:
          'If an account exists with this phone number, a verification code has been sent.',
      };
    }

    if (!user.phone_verified_at) {
      throw new BadRequestException({
        success: false,
        message:
          'Phone number is not verified',
        code: 'PHONE_NOT_VERIFIED',
      });
    }

    await this.twilioVerifyService.sendSms(
      user.phone_number,
    );

    return {
      success: true,
      message:
        'Verification code sent successfully',
      nextStep:
        'VERIFY_FORGOT_PASSWORD_OTP',
      data: {
        userId: user.id,
        resendAvailableIn: 30,
      },
    };
  }

  async verifyForgotPasswordOtp(
    userId: string,
    code: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      throw new BadRequestException({
        success: false,
        message:
          'Invalid password reset request',
        code: 'INVALID_RESET_REQUEST',
      });
    }

    if (!user.phone_number) {
      throw new BadRequestException({
        success: false,
        message:
          'Phone number not found',
        code: 'PHONE_NOT_FOUND',
      });
    }

    const verification =
      await this.twilioVerifyService.verifySms(
        user.phone_number,
        code,
      );

    if (
      !verification.success ||
      verification.status !==
        'approved'
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Invalid or expired verification code',
        code: 'OTP_INVALID',
      });
    }

    /*
    * Generate short-lived password reset token.
    */
    const resetToken =
      this.jwtService.sign(
        {
          sub: user.id,
          purpose:
            'password-reset',
        },
        {
          expiresIn: '10m',
        },
      );

    return {
      success: true,
      message:
        'Phone number verified successfully',
      nextStep:
        'RESET_PASSWORD',
      data: {
        resetToken,
      },
    };
  }

  async resetPassword(
    resetToken: string,
    password: string,
  ) {
    let payload: {
      sub: string;
      purpose: string;
    };

    try {
      payload =
        this.jwtService.verify(
          resetToken,
        );
    } catch {
      throw new UnauthorizedException({
        success: false,
        message:
          'Password reset token is invalid or expired',
        code: 'RESET_TOKEN_INVALID',
      });
    }

    if (
      payload.purpose !==
      'password-reset'
    ) {
      throw new UnauthorizedException({
        success: false,
        message:
          'Invalid password reset token',
        code: 'RESET_TOKEN_INVALID',
      });
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
      });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message:
          'Invalid password reset request',
        code: 'INVALID_RESET_REQUEST',
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        12,
      );

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password:
          hashedPassword,
        updated_at:
          new Date(),
      },
    });

    await this.redis.del(
      `refresh_token:${user.id}`,
    );

    return {
      success: true,
      message:
        'Password reset successfully',
    };
  }

  async verifyEmail({ email, token }) {
    try {
      const user = await this.userRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await this.ucodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          // await this.ucodeRepository.deleteToken({
          //   email: email,
          //   token: token,
          // });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resendVerificationEmail(email: string) {
    try {
      const user = await this.userRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await this.ucodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changePassword({ user_id, oldPassword, newPassword }) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);

      if (user) {
        const _isValidPassword = await this.userRepository.validatePassword({
          email: user.email,
          password: oldPassword,
        });
        if (_isValidPassword) {
          await this.userRepository.changePassword({
            email: user.email,
            password: newPassword,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid password',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);
      if (user) {
        const token = await this.ucodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await this.ucodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await this.userRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await this.ucodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await this.userRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await this.userRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async enable2FA(user_id: string) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);
      if (user) {
        await this.userRepository.enable2FA(user_id);
        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async disable2FA(user_id: string) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);
      if (user) {
        await this.userRepository.disable2FA(user_id);
        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------
}
