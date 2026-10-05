import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { Driver } from '../database/models/driver.model';
import { DriversService } from './drivers.service';

describe('DriversService deletion', () => {
  const driver = { isSoftDeleted: jest.fn(), destroy: jest.fn() };
  const model = { findByPk: jest.fn(), destroy: jest.fn() };
  const service = new DriversService(model as unknown as typeof Driver);

  beforeEach(() => {
    jest.resetAllMocks();
    model.findByPk.mockResolvedValue(driver);
    model.destroy.mockResolvedValue(1);
    driver.isSoftDeleted.mockReturnValue(true);
  });

  it('only permanently deletes an archived driver, using an atomic status check', async () => {
    await service.deletePermanently('driver-id');
    expect(model.findByPk).toHaveBeenCalledWith('driver-id', {
      paranoid: false,
    });
    expect(model.destroy).toHaveBeenCalledWith({
      where: { id: 'driver-id', deletedAt: { [Op.ne]: null } },
      force: true,
    });
    expect(driver.destroy).not.toHaveBeenCalled();
  });

  it('rejects permanent deletion of an active driver', async () => {
    driver.isSoftDeleted.mockReturnValue(false);
    await expect(service.deletePermanently('driver-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(model.destroy).not.toHaveBeenCalled();
  });

  it('returns not found for a missing driver', async () => {
    model.findByPk.mockResolvedValue(null);
    await expect(service.deletePermanently('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(model.destroy).not.toHaveBeenCalled();
  });

  it('reports a conflict when the driver is restored before deletion', async () => {
    model.destroy.mockResolvedValue(0);
    await expect(service.deletePermanently('driver-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('keeps dismissal as a recoverable soft delete', async () => {
    await service.remove('driver-id');
    expect(driver.destroy).toHaveBeenCalledWith();
    expect(model.destroy).not.toHaveBeenCalled();
  });
});
