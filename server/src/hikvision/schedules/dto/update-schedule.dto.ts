import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateScheduleDto } from './create-schedule.dto';

class Updatable extends OmitType(CreateScheduleDto, ['companyId'] as const) {}

export class UpdateScheduleDto extends PartialType(Updatable) {}
