# Backend modules

Each domain gets its own directory. Start with `routes.ts`, then add `service.ts` and `repository.ts` only when that separation becomes useful. Every route must authenticate/authorize and validate input before calling a service.
