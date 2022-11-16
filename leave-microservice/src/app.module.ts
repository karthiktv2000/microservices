import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { db_host, db_name } from './config';

import { LeaveModule } from './leave/leave.module';

@Module({
  imports: [
    MongooseModule.forRoot(`mongodb://${db_host}/${db_name}`),
    LeaveModule,
  ],
})
export class AppModule {}
