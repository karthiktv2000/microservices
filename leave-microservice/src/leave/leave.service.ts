import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { leaveDocument, statusEnum } from './leave.schema';
import { leaveDto } from 'src/dto/leave.dto';
const userProjection = {
  __v: false,
  _id: false,
  approveLink: false,
  rejectLink: false,
};

@Injectable()
export class LeaveService {
  constructor(
    @InjectModel('Leave') private readonly leaveModel: Model<leaveDocument>,
  ) {}
  async applyLeave(data: leaveDto): Promise<any> {
    try {
      const newDate = new Date(data.leaveDate);
      const leaveExist = await this.leaveModel.findOne({
        email: data.email,
        leaveDate: newDate.toISOString(),
      });
      if (leaveExist && leaveExist.rejected === true) {
        throw new HttpException(
          `For this date  ${data.leaveDate} , Leave is rejected `,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (leaveExist) {
        throw new HttpException(
          `Leave already exists for date ${data.leaveDate}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const newLeave = new this.leaveModel({
        email: data.email,
        leaveDate: newDate.toISOString(),
      });
      await newLeave.save();
      return {
        status: HttpStatus.CREATED,
        message: `sucessfully leave apllied for date ${data.leaveDate}`,
      };
    } catch (error) {
      return {
        status: error.status,
        message: error.message,
      };
    }
  }

  async checkEmployeeLeave(): Promise<any> {
    return await this.leaveModel.find({}, userProjection).exec();
  }

  async viewOwnLeave(data: leaveDto) {
    try {
      const existUser = await this.leaveModel
        .find({ email: data.email }, userProjection)
        .exec();
      if (existUser.length === 0) {
        throw new HttpException(
          `User with the email ${data.email}, Not apllied any leaves`,
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        message: `Details of user with status ${data.email}`,
        result: existUser,
        status: HttpStatus.OK,
      };
    } catch (error) {
      return {
        status: error.status,
        message: error.message,
      };
    }
  }

  async viewEmployeePendingLeaveByEmail(data: leaveDto): Promise<any> {
    try {
      const existUser = await this.leaveModel
        .find({ email: data.email }, userProjection)
        .exec();
      if (!existUser) {
        throw new HttpException('Invalid User ', HttpStatus.NOT_FOUND);
      } else if (existUser.length === 0) {
        throw new HttpException(
          'no Pending leaves or invalid email',
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        message: `Details of user with status ${data.email}`,
        result: existUser,
        status: HttpStatus.OK,
      };
    } catch (error) {
      return {
        status: error.status,
        message: error.message,
      };
    }
  }

  async viewEmployeePendingLeave(data: leaveDto): Promise<any> {
    try {
      const statusEnum_key = Object.keys(statusEnum).find(
        (key) => statusEnum[key] === data.status,
      );
      const existUser = await this.leaveModel
        .find({
          status: statusEnum_key,
          rejected: { $exists: false },
        })
        .exec();
      if (!existUser) {
        throw new HttpException('Invalid User ', HttpStatus.NOT_FOUND);
      }
      if (data.status === 'Pending')
        for (let i = 0; i < existUser.length; i++) {
          existUser[
            i
          ].approveLink = `http://localhost:3000/user/approveLeaves?leaveDate=${existUser[i].leaveDate}&email=${existUser[i].email}`;
          existUser[
            i
          ].rejectLink = `http://localhost:3000/user/rejectLeaves?leaveDate=${existUser[i].leaveDate}&email=${existUser[i].email}`;
          existUser[i].save();
        }
      return {
        message: `Details of user with status ${data.status}`,
        result: existUser,
        status: HttpStatus.OK,
      };
    } catch (error) {
      return {
        status: error.status,
        message: error.message,
      };
    }
  }

  async approveEmployeeLeaves(data: leaveDto): Promise<any> {
    try {
      const newDate = new Date(data.date);
      const IsoDate = newDate.toISOString();
      const user = await this.leaveModel.findOneAndUpdate(
        {
          email: data.email,
          leaveDate: IsoDate,
          status: false,
          approveLink: `http://localhost:3000/user/approveLeaves?leaveDate=${IsoDate}&email=${data.email}`,
        },
        {
          $set: { status: true },
          $unset: {
            approveLink: `http://localhost:3000/user/approveLeaves?leaveDate=${IsoDate}&email=${data.email}`,
            rejectLink: `http://localhost:3000/user/rejectLeaves?leaveDate=${IsoDate}&email=${data.email}`,
          },
        },
      );
      if (user) {
        return {
          message: `Leave approved successfully for date ${data.date}`,
          status: HttpStatus.OK,
        };
      } else {
        throw new HttpException('Link expired', HttpStatus.GONE);
      }
    } catch (error) {
      return {
        status: error.status,
        message: error.message,
      };
    }
  }

  async rejectEmployeeLeaves(data: leaveDto): Promise<any> {
    try {
      const newDate = new Date(data.date);
      const IsoDate = newDate.toISOString();
      const user = await this.leaveModel.findOneAndUpdate(
        {
          email: data.email,
          leaveDate: IsoDate,
          status: false,
          rejectLink: `http://localhost:3000/user/rejectLeaves?leaveDate=${IsoDate}&email=${data.email}`,
        },
        {
          $unset: {
            approveLink: `http://localhost:3000/user/approveLeaves?leaveDate=${IsoDate}&email=${data.email}`,
            rejectLink: `http://localhost:3000/user/rejectLeaves?leaveDate=${IsoDate}&email=${data.email}`,
          },
        },
      );
      if (user) {
        user.rejected = true;
        user.save();
        return {
          message: `Leave rejected successfully for date ${data.date}`,
          status: HttpStatus.OK,
        };
      } else {
        throw new HttpException('Link expired', HttpStatus.GONE);
      }
    } catch (error) {
      return {
        status: error.status,
        message: error.message,
      };
    }
  }
}
