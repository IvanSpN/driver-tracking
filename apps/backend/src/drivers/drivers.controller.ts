import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  list(@Query('official') official?: string, @Query('archived') archived?: string) {
    return this.driversService.list({
      official: official === undefined ? undefined : official === 'true',
      archived: archived === 'true',
    });
  }

  @Post()
  create(@Body() dto: CreateDriverDto, @CurrentUser() user: AccessTokenPayload) {
    return this.driversService.create(dto, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string) {
    return this.driversService.restore(id);
  }
}
