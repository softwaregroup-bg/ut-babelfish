#!/usr/bin/env node

require('../')().catch(error => {
    // eslint-disable-next-line no-console
    if (error.message !== 'silent') console.error(error);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
});
