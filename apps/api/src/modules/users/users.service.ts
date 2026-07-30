import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // upsert guards against the (unexpected) case where the profile row is missing.
    return this.prisma.profile.upsert({
      where: { userId },
      update: { ...dto },
      create: { userId, ...dto },
    });
  }

  async markOnboardingComplete(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hasCompletedOnboarding: true },
    });
  }
}
