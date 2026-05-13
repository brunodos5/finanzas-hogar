const { execSync } = require('child_process');

const message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' });

if (message.includes('[deploy]')) {
  process.exit(1);
}

process.exit(0);
