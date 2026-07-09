import { PartialType } from '@nestjs/swagger';
import { CreateTelegramChannelDto } from './create-channel.dto';

/**
 * Update — barcha maydonlar ixtiyoriy, validatsiya saqlanadi.
 * `Partial<CreateTelegramChannelDto>` ValidationPipe'ni chetlab o'tardi.
 */
export class UpdateTelegramChannelDto extends PartialType(
  CreateTelegramChannelDto,
) {}
