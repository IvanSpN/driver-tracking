import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './app.module';
import { User, UserRole } from './database/models/user.model';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const email = readArg('email');
  const password = readArg('password');
  const fullName = readArg('fullName') ?? 'Админ';

  if (!email || !password) {
    console.error('Использование: npm run seed:admin -- --email=admin@example.com --password=secret123 [--fullName="Имя Фамилия"]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<typeof User>(getModelToken(User));

  const passwordHash = await bcrypt.hash(password, 12);
  const [user, created] = await userModel.findOrCreate({
    where: { email },
    defaults: { email, passwordHash, fullName, role: UserRole.ADMIN },
  });

  if (!created) {
    user.passwordHash = passwordHash;
    user.fullName = fullName;
    await user.save();
    console.log(`Пароль обновлён: ${user.email}`);
  } else {
    console.log(`Пользователь создан: ${user.email}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
