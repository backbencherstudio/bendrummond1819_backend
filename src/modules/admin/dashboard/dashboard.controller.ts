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
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH } from 'src/common/swagger/swagger';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';

@ApiTags('Admin Dashboard')
@ApiBearerAuth(SWAGGER_AUTH.admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('subscription-usage')
  subscriptionUsage() {
    return this.dashboardService.subscriptionUsage();
  }

  @Get('states')
  dashboardStates() {
    return this.dashboardService.dashboardStates();
  }
}
