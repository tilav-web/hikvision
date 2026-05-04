import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEntity } from './entities/device.entity';
import { PersonEntity } from './entities/person.entity';
import { PersonDeviceEntity } from './entities/person-device.entity';
import { AccessEventEntity } from './entities/access-event.entity';
import { AgentEntity } from './entities/agent.entity';
import { DevicesService } from './devices/devices.service';
import { DevicesController } from './devices/devices.controller';
import { PersonsService } from './persons/persons.service';
import { PersonsController } from './persons/persons.controller';
import { EventsService } from './events/events.service';
import { EventsController } from './events/events.controller';
import { EventsGateway } from './events/events.gateway';
import { AgentsGateway } from './agents/agents.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      DeviceEntity,
      PersonEntity,
      PersonDeviceEntity,
      AccessEventEntity,
    ]),
  ],
  controllers: [DevicesController, PersonsController, EventsController],
  providers: [
    DevicesService,
    PersonsService,
    EventsService,
    EventsGateway,
    AgentsGateway,
  ],
  exports: [DevicesService, PersonsService, EventsService, AgentsGateway],
})
export class HikvisionModule {}
