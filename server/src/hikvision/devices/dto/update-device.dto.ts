import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateDeviceDto } from './create-device.dto';

class UpdatableDevice extends OmitType(CreateDeviceDto, [
  'companyId',
] as const) {}

export class UpdateDeviceDto extends PartialType(UpdatableDevice) {}
