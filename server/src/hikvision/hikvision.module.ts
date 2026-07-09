import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DeviceEntity } from './entities/device.entity';
import { PersonEntity } from './entities/person.entity';
import { PersonDeviceEntity } from './entities/person-device.entity';
import { AccessEventEntity } from './entities/access-event.entity';
import { AgentEntity } from './entities/agent.entity';
import { ScheduleEntity } from './entities/schedule.entity';
import { AttendanceEntity } from './entities/attendance.entity';
import { PenaltyEntity } from './entities/penalty.entity';
import { HolidayEntity } from './entities/holiday.entity';
import { VacationEntity } from './entities/vacation.entity';
import { DevicesService } from './devices/devices.service';
import { DeviceSyncService } from './devices/device-sync.service';
import { DevicesController } from './devices/devices.controller';
import { PersonsService } from './persons/persons.service';
import { PersonsController } from './persons/persons.controller';
import { EventsService } from './events/events.service';
import { EventsController } from './events/events.controller';
import { EventsGateway } from './events/events.gateway';
import { AgentsGateway } from './agents/agents.gateway';
import { AgentsService } from './agents/agents.service';
import { AgentsController } from './agents/agents.controller';
import { SchedulesService } from './schedules/schedules.service';
import { SchedulesController } from './schedules/schedules.controller';
import { AttendanceService } from './attendance/attendance.service';
import { AttendanceController } from './attendance/attendance.controller';
import {
  AttendanceProcessor,
  ATTENDANCE_QUEUE,
} from './attendance/attendance.processor';
import { PenaltiesService } from './penalties/penalties.service';
import { PenaltiesController } from './penalties/penalties.controller';
import { HolidaysService } from './holidays/holidays.service';
import { HolidaysController } from './holidays/holidays.controller';
import { VacationsService } from './vacations/vacations.service';
import { VacationsController } from './vacations/vacations.controller';
import { CompaniesModule } from '../companies/companies.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    CompaniesModule,
    TelegramModule,
    BullModule.registerQueue({ name: ATTENDANCE_QUEUE }),
    TypeOrmModule.forFeature([
      AgentEntity,
      DeviceEntity,
      PersonEntity,
      PersonDeviceEntity,
      AccessEventEntity,
      ScheduleEntity,
      AttendanceEntity,
      PenaltyEntity,
      HolidayEntity,
      VacationEntity,
    ]),
  ],
  controllers: [
    DevicesController,
    PersonsController,
    EventsController,
    AgentsController,
    SchedulesController,
    AttendanceController,
    PenaltiesController,
    HolidaysController,
    VacationsController,
  ],
  providers: [
    DevicesService,
    DeviceSyncService,
    PersonsService,
    EventsService,
    EventsGateway,
    AgentsGateway,
    AgentsService,
    SchedulesService,
    AttendanceService,
    AttendanceProcessor,
    PenaltiesService,
    HolidaysService,
    VacationsService,
  ],
  exports: [
    DevicesService,
    DeviceSyncService,
    PersonsService,
    EventsService,
    AgentsGateway,
    AgentsService,
    SchedulesService,
    AttendanceService,
    PenaltiesService,
    HolidaysService,
    VacationsService,
  ],
})
export class HikvisionModule {}
