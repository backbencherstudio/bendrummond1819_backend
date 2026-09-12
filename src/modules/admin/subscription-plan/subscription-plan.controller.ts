import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionPlanService } from './subscription-plan.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH } from 'src/common/swagger/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Admin Subscription Plan')
@ApiBearerAuth(SWAGGER_AUTH.admin)
@Controller('admin/subscription-plan')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SubscriptionPlanController {
  constructor(
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  @Post()
  createPlan(@Body() createSubscriptionPlanDto: CreateSubscriptionPlanDto) {
    return this.subscriptionPlanService.createPlan(createSubscriptionPlanDto);
  }

  @Get()
  findAllPlans() {
    return this.subscriptionPlanService.findAllPlans();
  }

  @Get(':id')
  findOnePlan(@Param('id') id: string) {
    return this.subscriptionPlanService.findOnePlan(id);
  }

  @Patch(':id')
  updatePlan(
    @Param('id') id: string,
    @Body() updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlanService.updatePlan(
      id,
      updateSubscriptionPlanDto,
    );
  }

  @Delete(':id')
  removePlan(@Param('id') id: string) {
    return this.subscriptionPlanService.removePlan(id);
  }
}
