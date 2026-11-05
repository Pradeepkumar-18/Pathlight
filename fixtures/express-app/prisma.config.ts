import { defineConfig } from 'prisma/config';

// Prisma's CLI requires a default export here.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: 'file:./prisma/fixture.db' },
});
