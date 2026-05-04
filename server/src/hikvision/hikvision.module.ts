import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEntity } from './entities/device.entity';
import { PersonEntity } from './entities/person.entity';
import { PersonDeviceEntity } from './entities/person-device.entity';
import { AccessEventEntity } from './entities/access-event.entity';
import { AgentEntity } from './entities/agent.entity';
import { ScheduleEntity } from './entities/schedule.entity';
import { AttendanceEntity } from './entities/attendance.entity';
import { PenaltyEntity } from './entities/penalty.entity';
import { DevicesService } from './devices/devices.service';
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
import { PenaltiesService } from './penalties/penalties.service';
import { PenaltiesController } from './penalties/penalties.controller';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    CompaniesModule,
    TypeOrmModule.forFeature([
      AgentEntity,
      DeviceEntity,
      PersonEntity,
      PersonDeviceEntity,
      AccessEventEntity,
      ScheduleEntity,
      AttendanceEntity,
      PenaltyEntity,
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
  ],
  providers: [
    DevicesService,
    PersonsService,
    EventsService,
    EventsGateway,
    AgentsGateway,
    AgentsService,
    SchedulesService,
    AttendanceService,
    PenaltiesService,
  ],
  exports: [
    DevicesService,
    PersonsService,
    EventsService,
    AgentsGateway,
    AgentsService,
    SchedulesService,
    AttendanceService,
    PenaltiesService,
  ],
})
export class HikvisionModule {}
