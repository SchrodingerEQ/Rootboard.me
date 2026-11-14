// Imported for its side effect, second in server/index.ts (after dotenv):
// ES modules run their imports in order, so wrapping console here, before
// the services are imported, puts their startup lines (e.g. the Google key
// check that runs at construction) into the diagnostics log tail too.
import { installLogRing } from "./services/logRing";

installLogRing();
