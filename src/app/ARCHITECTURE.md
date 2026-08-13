# Clean Architecture boundaries

The source code follows these dependency rules:

| Source layer | May depend on |
| --- | --- |
| `domain` | `domain` only |
| `application` | `application`, `domain` |
| `presentation` | `presentation`, `application` |
| `infrastructure` | `infrastructure`, `application`, `domain` |

Files directly under `src/app` are the composition root. They may connect
application ports to infrastructure and presentation implementations, then
bootstrap the application.

Reusable UI components and layouts live in `presentation/shared`. The
`@shared/*` alias points to that directory and is therefore treated as a
presentation dependency.

Cross-layer behavior must use application ports. For example, infrastructure
obtains the current user identifier through `CurrentUserProvider` instead of
depending on presentation session state.

Run `npm run check:architecture` to validate imports. The check also runs before
every production build.
