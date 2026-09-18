import { DocumentBuilder } from '@nestjs/swagger';
import appConfig from 'src/config/app.config';

export const SWAGGER_AUTH = {
  admin: 'admin-token',
  user: 'user-token',
} as const;

export type SwaggerAuthKey = keyof typeof SWAGGER_AUTH;

export function buildSwaggerOptions() {
  const builder = new DocumentBuilder()
    .setTitle(`${appConfig().app.name} API`)
    .setVersion('1.0')
    .addServer('http://10.10.9.189:4000');

  Object.values(SWAGGER_AUTH).forEach((name) => {
    builder.addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      name,
    );
  });
  return builder.build();
}

export const swaggerUiOptions = {
  swaggerOptions: {
    persistAuthorization: true,
  },
};
