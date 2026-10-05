import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Driver } from '../database/models/driver.model';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

export interface ListDriversFilter {
  official?: boolean;
  archived?: boolean;
}

@Injectable()
export class DriversService {
  constructor(
    @InjectModel(Driver) private readonly driverModel: typeof Driver,
  ) {}

  list(filter: ListDriversFilter) {
    const where: Record<string, unknown> = {};
    if (filter.official !== undefined) where.isOfficial = filter.official;
    if (filter.archived) where.deletedAt = { [Op.ne]: null };

    return this.driverModel.findAll({
      where,
      paranoid: !filter.archived,
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC'],
      ],
    });
  }

  async findOne(id: string) {
    const driver = await this.driverModel.findByPk(id, { paranoid: false });
    if (!driver) throw new NotFoundException('Водитель не найден');
    return driver;
  }

  create(dto: CreateDriverDto, createdById: string) {
    return this.driverModel.create({ ...dto, createdById });
  }

  async update(id: string, dto: UpdateDriverDto) {
    const driver = await this.findOne(id);
    await driver.update(dto);
    return driver;
  }

  async remove(id: string) {
    const driver = await this.findOne(id);
    await driver.destroy();
  }

  async restore(id: string) {
    const driver = await this.findOne(id);
    await driver.restore();
    return driver;
  }
}
