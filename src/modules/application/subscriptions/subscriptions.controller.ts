import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SWAGGER_AUTH } from 'src/common/swagger/swagger';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { PlanType } from 'prisma/generated/enums';

@ApiTags('User Subscriptions')
@ApiBearerAuth(SWAGGER_AUTH.user)
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiQuery({ name: 'type', enum: PlanType, required: false })
  findAllPlans(@Query('type') type?: PlanType) {
    return this.subscriptionsService.findAllPlans(type);
  }

  @Get('my-subscription')
  mySubscription(@Req() req: any) {
    const user_id = req.user.userId;
    return this.subscriptionsService.mySubscription(user_id);
  }

  // @Get('my-active-subscription')
  // myActiveSubscription(@Req() req: any) {
  //   const user_id = req.user.userId;
  //   return this.subscriptionsService.myActiveSubscription(user_id);
  // }

  @Patch('cancel-subscription')
  cancelSubscription(@Req() req: any) {
    const user_id = req.user.userId;
    return this.subscriptionsService.cancelSubscription(user_id);
  }

  @Patch('change-plan')
  changeSubscriptionPlan(@Req() req: any, @Body('plan_id') plan_id: string) {
    const user_id = req.user.userId;
    return this.subscriptionsService.changeSubscriptionPlan(user_id, plan_id);
  }

  // @Get(':id')
  // findOnePlan(@Param('id') id: string) {
  //   return this.subscriptionsService.findOnePlan(id);
  // }

  @Post(':id')
  buySubscription(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user.userId;
    return this.subscriptionsService.buySubscription(id, user_id);
  }

  // @Get('biling/history')
  // allBilingHistory(@Req() req: any) {
  //   const user_id = req.user.userId;
  //   return this.subscriptionsService.allBilingHistory(user_id);
  // }
}
