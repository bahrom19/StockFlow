# StockFlow Backend

This directory contains the production-ready foundation for the StockFlow Enterprise backend.

## Included foundation

- NestJS with TypeScript strict mode
- ESLint and Prettier configuration
- Prisma ORM with PostgreSQL support
- Redis integration
- Swagger documentation
- Health check endpoint
- Environment configuration
- Modular monolith structure with a DDD-inspired layout
- Repository pattern scaffold
- Docker support

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create the environment file:
   ```bash
   cp .env.example .env
   ```
3. Run Prisma generate:
   ```bash
   npm run prisma:generate
   ```
4. Start the development server:
   ```bash
   npm run start:dev
   ```

## Docker

```bash
docker compose up --build
```
