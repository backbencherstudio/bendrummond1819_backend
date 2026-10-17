import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentTransactionService } from './payment-transaction.service';
import {
  BillingHistoryQueryDto,
  BillingHistoryResponseDto,
} from './dto/billing-history.dto';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SWAGGER_AUTH } from '../../../common/swagger/swagger';

@ApiTags('Admin Billing History')
@ApiBearerAuth(SWAGGER_AUTH.admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller(['admin/billing-history', 'admin/transactions'])
export class BillingHistoryController {
  constructor(private readonly service: PaymentTransactionService) {}

  @ApiOperation({
    summary: 'List billing history and transaction logs',
    description:
      'Admin-only, newest first. Includes all transaction statuses and excludes deleted transactions. Supports pagination, search, status, user and date filters.',
  })
  @ApiOkResponse({ type: BillingHistoryResponseDto })
  @Get()
  findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: BillingHistoryQueryDto,
  ) {
    return this.service.billingHistory(query);
  }
}
