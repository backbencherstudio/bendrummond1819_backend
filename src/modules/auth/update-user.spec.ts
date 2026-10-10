import { ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSwaggerDto } from './dto/update-swagger.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';

jest.mock('../../common/lib/Payment/stripe/StripePayment', () => ({
  StripePayment: {},
}));

describe('Profile update', () => {
  let service: AuthService;
  let prisma: any;
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const parse = (value: object) =>
    pipe.transform(value, { type: 'body', metatype: UpdateUserDto });
  const image = {
    mimetype: 'image/png',
    originalname: '../../unsafe.png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
  } as Express.Multer.File;
  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'u1',
          avatar: 'old.png',
          email: 'old@example.com',
          phone_number: '+14155552671',
        }),
        update: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'u1',
          ...data,
          password: undefined,
        })),
      },
    };
    service = new AuthService(null, prisma, null, null, null, null, null);
    jest.spyOn(SojebStorage, 'put').mockResolvedValue(undefined);
    jest.spyOn(SojebStorage, 'isExists').mockResolvedValue(true);
    jest.spyOn(SojebStorage, 'delete').mockResolvedValue(true);
    jest
      .spyOn(SojebStorage, 'url')
      .mockImplementation((key) => `https://example.com/storage/${key}`);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([undefined, '', null, 'null'])(
    'accepts a form update without an image (%p)',
    async (imageValue) => {
      const dto = await parse({ name: 'Updated name', image: imageValue });
      await service.updateUser('u1', dto, null);
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
        name: 'Updated name',
      });
      expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty(
        'avatar',
      );
      expect(SojebStorage.put).not.toHaveBeenCalled();
      expect(SojebStorage.delete).not.toHaveBeenCalled();
    },
  );
  it('rejects text pretending to be an uploaded image', async () => {
    await expect(
      parse({ name: 'Updated name', image: 'fake.png' }),
    ).rejects.toThrow();
  });
  it('persists false settings and leaves omitted profile fields untouched', async () => {
    const dto = await parse({
      bill_remainders: 'false',
      notification_remainder: 'false',
      email_updates: 'false',
    });
    await service.updateUser('u1', dto);
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      bill_remainders: false,
      notification_remainder: false,
      email_updates: false,
    });
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('name');
  });
  it.each([
    { email_updates: 'bad' },
    { name: null },
    { date_of_birth: '2025-02-30' },
    { type: 'admin' },
    { email: 'bad' },
  ])('rejects invalid input %p', async (input) => {
    await expect(parse(input)).rejects.toThrow();
  });
  it('updates the profile and accepts the app ISO birth date', async () => {
    const dto = await parse({
      name: ' Jane ',
      email: ' JANE@EXAMPLE.COM ',
      phone_number: '+44 7911 123456',
      date_of_birth: '1999-12-31T00:00:00.000Z',
    });
    await service.updateUser('u1', dto);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: 'Jane',
      email: 'jane@example.com',
      phone_number: '+447911123456',
      email_verified_at: null,
      phone_verified_at: null,
    });
    expect(data.date_of_birth.toISOString()).toBe('1999-12-31T00:00:00.000Z');
    expect(data).not.toHaveProperty('password');
    expect(prisma.user.update.mock.calls[0][0].select).not.toHaveProperty(
      'password',
    );
  });
  it.each([{ password: 'new-password' }, { confirm_password: 'new-password' }])(
    'rejects password fields in the profile API %p',
    async (input) => {
      await expect(parse(input)).rejects.toThrow();
    },
  );
  it.each([
    { name: 'Updated name' },
    { email: 'updated@example.com' },
    { bill_remainders: false },
    { notification_remainder: false },
    { email_updates: false },
  ])('updates just the supplied field %p', async (input) => {
    await service.updateUser('u1', await parse(input));
    const data = prisma.user.update.mock.calls[0][0].data;
    const field = Object.keys(input)[0];
    expect(data[field]).toBe(input[field]);
    const allowed =
      field === 'email'
        ? ['email', 'email_verified_at', 'updated_at']
        : [field, 'updated_at'];
    expect(Object.keys(data).sort()).toEqual(allowed.sort());
  });
  it.each(['bill_remainders', 'notification_remainder', 'email_updates'])(
    'allows repeatedly toggling %s in either direction',
    async (field) => {
      for (const value of [true, false, true, false]) {
        await service.updateUser('u1', await parse({ [field]: String(value) }));
        expect(
          prisma.user.update.mock.calls[
            prisma.user.update.mock.calls.length - 1
          ][0].data[field],
        ).toBe(value);
      }
    },
  );
  it('rejects an empty patch and invalid phone', async () => {
    await expect(service.updateUser('u1', {})).rejects.toThrow('at least one');
    await expect(
      service.updateUser('u1', { phone_number: '123' }),
    ).rejects.toThrow('Invalid phone');
  });
  it('checks user existence before touching storage', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.updateUser('u1', {}, image)).rejects.toThrow(
      'User not found',
    );
    expect(SojebStorage.put).not.toHaveBeenCalled();
  });
  it('keeps the old avatar until the database save succeeds', async () => {
    prisma.user.update.mockImplementation(async ({ data }) => {
      expect(SojebStorage.delete).not.toHaveBeenCalled();
      return { id: 'u1', avatar: data.avatar };
    });
    const result = await service.updateUser('u1', {}, image);
    expect(result.data.avatar_url).toMatch(/storage\/avatar\/.*\.png$/);
    expect(SojebStorage.delete).toHaveBeenCalledWith('avatar/old.png');
    expect(jest.mocked(SojebStorage.put).mock.calls[0][0]).not.toContain(
      'unsafe',
    );
  });
  it('removes the new upload on a uniqueness conflict and preserves the old avatar', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2002' });
    await expect(service.updateUser('u1', {}, image)).rejects.toThrow(
      'already in use',
    );
    expect(SojebStorage.delete).toHaveBeenCalledWith(
      jest.mocked(SojebStorage.put).mock.calls[0][0],
    );
    expect(SojebStorage.delete).not.toHaveBeenCalledWith('avatar/old.png');
  });
  it('does not save a missing upload or invalid image', async () => {
    jest.mocked(SojebStorage.isExists).mockResolvedValue(false);
    await expect(service.updateUser('u1', {}, image)).rejects.toThrow(
      'upload failed',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    await expect(
      service.updateUser(
        'u1',
        {},
        { ...image, buffer: Buffer.from('fake image') },
      ),
    ).rejects.toThrow('valid JPEG');
  });
  it('documents a binary file picker and every app field', () => {
    const schemas: any = {};
    new SchemaObjectFactory(
      new ModelPropertiesAccessor(),
      new SwaggerTypesMapper(),
    ).exploreModelSchema(UpdateSwaggerDto, schemas);
    const properties = schemas.UpdateSwaggerDto.properties;
    expect(properties.image).toMatchObject({
      type: 'string',
      format: 'binary',
      nullable: true,
    });
    for (const field of [
      'name',
      'email',
      'phone_number',
      'date_of_birth',
      'bill_remainders',
      'notification_remainder',
      'email_updates',
    ])
      expect(properties[field]).toBeDefined();
    expect(properties).not.toHaveProperty('password');
    expect(properties).not.toHaveProperty('confirm_password');
    expect(schemas.UpdateSwaggerDto.required).toBeUndefined();
  });
});
