import { Controller } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { MessagePattern } from '@nestjs/microservices';
import { leaveDto } from '../dto/leave.dto';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @MessagePattern({ cmd: 'applyLeave' })
  async applyLeave(data: leaveDto) {
    return await this.leaveService.applyLeave(data);
  }

  @MessagePattern({ cmd: 'checkEmployeeLeave' })
  async checkEmployeeLeave() {
    return {
      message: 'details',
      result: await this.leaveService.checkEmployeeLeave(),
    };
  }

  @MessagePattern({ cmd: 'viewOwnLeave' })
  async viewOwnLeave(data: leaveDto) {
    return await this.leaveService.viewOwnLeave(data);
  }

  @MessagePattern({ cmd: 'viewEmployeePendingLeaveByEmail' })
  async viewEmployeePendingLeaveByEmail(data: leaveDto) {
    return await this.leaveService.viewEmployeePendingLeaveByEmail(data);
  }

  @MessagePattern({ cmd: 'viewEmployeePendingLeave' })
  async viewEmployeePendingLeave(data: leaveDto) {
    return await this.leaveService.viewEmployeePendingLeave(data);
  }

  @MessagePattern({ cmd: 'approveEmployeeLeaves' })
  async approveEmployeeLeaves(data: leaveDto) {
    return await this.leaveService.approveEmployeeLeaves(data);
  }

  @MessagePattern({ cmd: 'rejectEmployeeLeaves' })
  async rejectEmployeeLeaves(data: leaveDto) {
    return await this.leaveService.rejectEmployeeLeaves(data);
  }
}
