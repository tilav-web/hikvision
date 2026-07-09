import { PartialType } from '@nestjs/swagger';
import { CreateVacationDto } from './create-vacation.dto';

/**
 * Update — barcha maydonlar ixtiyoriy, lekin validatsiya saqlanadi.
 * `Partial<CreateVacationDto>` ishlatilsa ValidationPipe metadata topa olmay
 * validatsiyani butunlay o'tkazib yuborardi.
 */
export class UpdateVacationDto extends PartialType(CreateVacationDto) {}
