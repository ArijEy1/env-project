export const jwtConstants = {
  secret: process.env.JWT_SECRET ?? 'env-project-dev-secret',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
};
