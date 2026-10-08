// The Node action receives artifact runtime credentials directly from the runner.
// They are never exported to a shell step or written to GITHUB_ENV.
import {runStagingInitialMigrationCLI} from '../../../scripts/staging-initial-migrate.mjs';
await runStagingInitialMigrationCLI();
